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
        
        // 리사이즈 이벤트
        window.addEventListener('resize', () => {
            this.handleResize();
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
        this.positionItem(element, this.items.length - 1);
    }
    
    positionItem(element, index) {
        // 가로 우선 배치 로직
        const columnIndex = index % this.columns;
        const columnWidth = (this.container.offsetWidth - (this.columns - 1) * this.gap) / this.columns;
        
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
            if (img.complete) {
                this.updateColumnHeight(columnIndex, element);
            } else {
                img.onload = () => {
                    this.updateColumnHeight(columnIndex, element);
                };
            }
        }
    }
    
    updateColumnHeight(columnIndex, element) {
        const rect = element.getBoundingClientRect();
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
    masonryInstance = new HorizontalMasonry(gallery, { gap: 16 });
    
    // 초기 이미지 로드
    loadImages(true);
    
    // 정렬 버튼 이벤트
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
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
    
    // 스크롤 이벤트
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (isLoading || !hasMore) {
                    ticking = false;
                    return;
                }
                
                if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1500) {
                    loadImages(false);
                }
                ticking = false;
            });
            ticking = true;
        }
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
    
    if (!isInitial) {
        loadingMore.classList.remove('hidden');
    }
    
    try {
        const response = await fetch(`/api/gallery?page=${currentPage}&per_page=15&sort=${currentSort}`);
        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
            await appendImagesWithMasonry(data.images);
            
            hasMore = data.has_more;
            currentPage++;
            
            emptyGallery.classList.add('hidden');
            
            if (!hasMore) {
                endMessage.classList.remove('hidden');
            }
        } else if (isInitial) {
            emptyGallery.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('이미지 로드 오류:', error);
        alert('이미지를 불러오는데 실패했습니다.');
    } finally {
        isLoading = false;
        loadingMore.classList.add('hidden');
    }
}

async function appendImagesWithMasonry(images) {
    const imagePromises = images.map(async (image, index) => {
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
                            <span class="like-count">❤️ ${image.likes}</span>
                        </div>
                        <div class="image-prompt">
                            <p>${image.prompt.length > 50 ? image.prompt.substring(0, 50) + '...' : image.prompt}</p>
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
                    
                    // 마소너리 높이 업데이트
                    setTimeout(() => {
                        masonryInstance.relayout();
                    }, 50);
                }, 50);
                
                resolve();
            };
            
            preloadImg.onerror = () => {
                loadingText.textContent = '로드 실패';
                loadingText.style.color = '#ef4444';
                container.classList.remove('loading');
                resolve();
            };
            
            setTimeout(() => {
                preloadImg.src = image.result_image;
            }, index * 50);
        });
    });
}

async function openModal(imageId) {
    currentImageId = imageId;
    
    try {
        const response = await fetch(`/image/${imageId}`);
        const data = await response.json();

        if (response.ok) {
            const modalImg = document.getElementById('modalImage');
            const preloadImg = new Image();
            
            preloadImg.onload = () => {
                modalImg.src = data.result_image;
                modalImg.style.opacity = '1';
            };
            
            modalImg.style.opacity = '0.5';
            preloadImg.src = data.result_image;
            
            document.getElementById('modalDate').textContent = formatDate(data.created_at);
            document.getElementById('likeCount').textContent = data.likes;
            document.getElementById('modalPrompt').textContent = data.prompt;
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
                    imgElement.alt = img.filename;
                    imgElement.title = img.filename;
                    modalImages.appendChild(imgElement);
                });
            }

            document.getElementById('imageModal').style.display = 'block';
            document.body.style.overflow = 'hidden';
        } else {
            alert('이미지 정보를 불러올 수 없습니다.');
        }
    } catch (error) {
        alert('오류가 발생했습니다: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
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
        const data = await response.json();

        if (data.success) {
            document.getElementById('likeCount').textContent = data.likes;
            likeBtn.classList.add('liked', 'disabled');
            likeBtn.style.background = '#fef2f2';
            likeBtn.style.borderColor = '#fca5a5';
            likeBtn.style.color = '#dc2626';
            
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
                alert('좋아요 처리 중 오류가 발생했습니다.');
            }
        }
    } catch (error) {
        console.error('좋아요 오류:', error);
        alert('좋아요 처리 중 오류가 발생했습니다.');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
