let currentImageId = null;
let userLikedImages = new Set();
let currentPage = 1;
let currentSort = 'newest';
let isLoading = false;
let hasMore = true;
let masonryInstance = null;

// 마소너리 레이아웃 클래스
class HorizontalMasonry {
    constructor(container, options = {}) {
        this.container = container;
        this.items = [];
        this.columns = this.getColumns();
        this.columnHeights = new Array(this.columns).fill(0);
        this.gap = options.gap || 16;
        this.resizeTimeout = null; // 디바운싱용
        
        // 리사이즈 이벤트 (디바운싱 추가)
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 150);
        });
    }
    
    getColumns() {
        const width = window.innerWidth;
        if (width <= 480) return 1;
        if (width <= 768) return 2;
        if (width <= 1200) return 3;
        return 4;
    }
    
    addItem(element) {
        this.items.push(element);
        this.container.appendChild(element); // DOM에 추가
        this.positionItem(element, this.items.length - 1);
    }
    
    positionItem(element, index) {
        // 가로 우선 배치 로직
        const columnIndex = index % this.columns;
        const containerWidth = this.container.offsetWidth;
        
        // 컨테이너 너비가 0이면 잠시 대기
        if (containerWidth === 0) {
            setTimeout(() => this.positionItem(element, index), 10);
            return;
        }
        
        const columnWidth = (containerWidth - (this.columns - 1) * this.gap) / this.columns;
        
        // X 위치 계산
        const x = columnIndex * (columnWidth + this.gap);
        
        // Y 위치 계산 (해당 컬럼의 현재 높이)
        const y = this.columnHeights[columnIndex];
        
        // 요소 위치 설정
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.width = `${columnWidth}px`;
        
        // 이미지 로드 후 높이 업데이트
        const img = element.querySelector('img');
        if (img) {
            if (img.complete && img.naturalHeight !== 0) {
                this.updateColumnHeight(columnIndex, element);
            } else {
                img.onload = () => {
                    this.updateColumnHeight(columnIndex, element);
                };
                // 로딩 실패시에도 높이 업데이트
                img.onerror = () => {
                    this.updateColumnHeight(columnIndex, element);
                };
            }
        } else {
            // 이미지가 없는 경우에도 높이 업데이트
            this.updateColumnHeight(columnIndex, element);
        }
    }
    
    updateColumnHeight(columnIndex, element) {
        const elementHeight = element.offsetHeight;
        this.columnHeights[columnIndex] += elementHeight + this.gap;
        
        // 컨테이너 높이 업데이트
        const maxHeight = Math.max(...this.columnHeights);
        this.container.style.height = `${maxHeight}px`;
    }
    
    clear() {
        this.items = [];
        this.columnHeights = new Array(this.columns).fill(0);
        this.container.style.height = '0px';
        this.container.innerHTML = '';
    }
    
    handleResize() {
        const newColumns = this.getColumns();
        if (newColumns !== this.columns) {
            this.columns = newColumns;
            this.columnHeights = new Array(this.columns).fill(0);
            this.relayout();
        }
    }
    
    relayout() {
        this.columnHeights = new Array(this.columns).fill(0);
        this.items.forEach((item, index) => {
            this.positionItem(item, index);
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // 마소너리 인스턴스 생성
    const gallery = document.getElementById('gallery');
    if (!gallery) {
        console.error('Gallery container not found!');
        return;
    }
    
    masonryInstance = new HorizontalMasonry(gallery, { gap: 16 });
    
    // 초기 이미지 로드
    loadImages(true);
    
    // 정렬 버튼 이벤트
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 이미 활성화된 버튼이면 리턴
            if (this.classList.contains('active')) return;
            
            // 활성 상태 변경
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 정렬 변경 및 새로고침
            currentSort = this.dataset.sort;
            currentPage = 1;
            hasMore = true;
            masonryInstance.clear();
            loadImages(true);
        });
    });
    
    // 스크롤 이벤트 (성능 최적화)
    let ticking = false;
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 스크롤 방향 체크 (아래로만)
        if (scrollTop > lastScrollTop && !ticking) {
            requestAnimationFrame(() => {
                if (isLoading || !hasMore) {
                    ticking = false;
                    return;
                }
                
                // 더 일찍 로드 시작 (1500px 전에)
                if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1500) {
                    loadImages(false);
                }
                ticking = false;
            });
            ticking = true;
        }
        lastScrollTop = scrollTop;
    });
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});

async function loadImages(isInitial = false) {
    if (isLoading) return;
    
    isLoading = true;
    const loadingMore = document.getElementById('loadingMore');
    const emptyGallery = document.getElementById('emptyGallery');
    const endMessage = document.getElementById('endMessage');
    
    if (!isInitial && loadingMore) {
        loadingMore.classList.remove('hidden');
    }
    
    try {
        const response = await fetch(`/api/gallery?page=${currentPage}&per_page=15&sort=${currentSort}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
            await appendImagesWithMasonry(data.images);
            
            hasMore = data.has_more;
            currentPage++;
            
            if (emptyGallery) emptyGallery.classList.add('hidden');
            
            if (!hasMore && endMessage) {
                endMessage.classList.remove('hidden');
            }
        } else if (isInitial && emptyGallery) {
            emptyGallery.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('이미지 로드 오류:', error);
        
        // 사용자 친화적 오류 메시지
        if (error.message.includes('401')) {
            alert('로그인이 필요합니다. 페이지를 새로고침하세요.');
            window.location.reload();
        } else {
            alert('이미지를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    } finally {
        isLoading = false;
        if (loadingMore) loadingMore.classList.add('hidden');
    }
}

async function appendImagesWithMasonry(images) {
    const imagePromises = images.map((image, index) => {
        return new Promise((resolve) => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            
            // 스켈레톤 먼저 표시
            galleryItem.innerHTML = `
                <div class="image-container loading">
                    <div class="image-loading-text">로딩중...</div>
                    <img src="" alt="생성된 이미지" style="display: none;">
                    <div class="image-overlay">
                        <div class="like-info">
                            <span class="like-count">❤️ ${image.likes || 0}</span>
                        </div>
                        <div class="image-prompt">
                            <p>${image.prompt && image.prompt.length > 50 ? image.prompt.substring(0, 50) + '...' : (image.prompt || '')}</p>
                        </div>
                    </div>
                </div>
            `;
            
            // 마소너리에 추가
            masonryInstance.addItem(galleryItem);
            
            // 이미지 미리 로드
            const img = galleryItem.querySelector('img');
            const container = galleryItem.querySelector('.image-container');
            const loadingText = galleryItem.querySelector('.image-loading-text');
            
            const preloadImg = new Image();
            preloadImg.onload = () => {
                img.src = image.result_image;
                img.style.display = 'block';
                
                setTimeout(() => {
                    img.classList.add('loaded');
                    container.classList.remove('loading');
                    container.classList.add('loaded');
                    if (loadingText) loadingText.remove();
                    
                    // 클릭 이벤트 추가
                    galleryItem.onclick = () => openModal(image.id);
                    
                    // 마소너리 높이 업데이트 (약간의 지연)
                    setTimeout(() => {
                        masonryInstance.relayout();
                    }, 100);
                }, 50);
                
                resolve();
            };
            
            preloadImg.onerror = () => {
                if (loadingText) {
                    loadingText.textContent = '로드 실패';
                    loadingText.style.color = '#ef4444';
                }
                container.classList.remove('loading');
                resolve();
            };
            
            // 순차적 로딩 (자연스러운 효과)
            setTimeout(() => {
                preloadImg.src = image.result_image;
            }, index * 50);
        });
    });
    
    // 모든 이미지 처리 완료까지 기다리지 않음
    return Promise.resolve();
}

async function openModal(imageId) {
    if (!imageId) return;
    
    currentImageId = imageId;
    
    try {
        const response = await fetch(`/image/${imageId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        const modalImg = document.getElementById('modalImage');
        const preloadImg = new Image();
        
        preloadImg.onload = () => {
            modalImg.src = data.result_image;
            modalImg.style.opacity = '1';
        };
        
        preloadImg.onerror = () => {
            modalImg.style.opacity = '1';
            modalImg.alt = '이미지 로드 실패';
        };
        
        modalImg.style.opacity = '0.5';
        preloadImg.src = data.result_image;
        
        document.getElementById('modalDate').textContent = formatDate(data.created_at);
        document.getElementById('likeCount').textContent = data.likes || 0;
        document.getElementById('modalPrompt').textContent = data.prompt || '';
        document.getElementById('modalResponse').textContent = data.response_text || 'AI가 이미지를 생성했습니다.';

        const likeBtn = document.getElementById('likeBtn');
        if (data.user_liked) {
            likeBtn.classList.add('liked', 'disabled');
            likeBtn.style.background = '#fef2f2';
            likeBtn.style.borderColor = '#fca5a5';
            likeBtn.style.color = '#dc2626';
        } else {
            likeBtn.classList.remove('liked', 'disabled');
            likeBtn.style.background = '#f1f5f9';
            likeBtn.style.borderColor = '#cbd5e1';
            likeBtn.style.color = '#475569';
        }

        const modalImages = document.getElementById('modalImages');
        modalImages.innerHTML = '';
        if (data.uploaded_images && data.uploaded_images.length > 0) {
            data.uploaded_images.forEach(img => {
                const imgElement = document.createElement('img');
                imgElement.src = img.path;
                imgElement.alt = img.filename || '첨부 이미지';
                imgElement.title = img.filename || '첨부 이미지';
                imgElement.onerror = function() {
                    this.style.display = 'none';
                };
                modalImages.appendChild(imgElement);
            });
        }

        document.getElementById('imageModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('모달 오류:', error);
        alert('이미지 정보를 불러올 수 없습니다.');
    }
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    currentImageId = null;
}

async function likeImage() {
    if (!currentImageId) return;
    
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn.classList.contains('disabled')) return;

    try {
        const response = await fetch(`/like/${currentImageId}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.success) {
            document.getElementById('likeCount').textContent = data.likes;
            likeBtn.classList.add('liked', 'disabled');
            likeBtn.style.background = '#fef2f2';
            likeBtn.style.borderColor = '#fca5a5';
            likeBtn.style.color = '#dc2626';
            
            // 갤러리의 좋아요 수도 업데이트
            const galleryItems = document.querySelectorAll('.gallery-item');
            galleryItems.forEach(item => {
                const img = item.querySelector('img');
                if (img && img.src.includes(currentImageId)) {
                    const likeCount = item.querySelector('.like-count');
                    if (likeCount) {
                        likeCount.textContent = `❤️ ${data.likes}`;
                    }
                }
            });
        } else {
            if (data.already_liked) {
                alert('이미 좋아요를 누른 이미지입니다!');
            } else {
                alert(data.error || '좋아요 처리 중 오류가 발생했습니다.');
            }
        }
    } catch (error) {
        console.error('좋아요 오류:', error);
        alert('좋아요 처리 중 오류가 발생했습니다.');
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        
        // 유효한 날짜인지 체크
        if (isNaN(date.getTime())) {
            return dateString; // 원본 반환
        }
        
        // 한국 시간대로 강제 변환
        const options = {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        return date.toLocaleString('ko-KR', options);
    } catch (error) {
        console.error('날짜 포맷 오류:', error);
        return dateString;
    }
}
