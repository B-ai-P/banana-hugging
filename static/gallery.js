let currentImageId = null;
let userLikedImages = new Set();
let currentPage = 1;
let currentSort = 'newest';
let isLoading = false;
let hasMore = true;

// 행별 그리드 레이아웃 클래스
class RowGridLayout {
    constructor(container, options = {}) {
        this.container = container;
        this.itemsPerRow = this.getItemsPerRow();
        this.currentRow = null;
        this.itemsInCurrentRow = 0;
        this.resizeTimeout = null;
        
        // 리사이즈 이벤트
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 150);
        });
    }
    
    getItemsPerRow() {
        const width = window.innerWidth;
        if (width <= 480) return 1;
        if (width <= 768) return 2; 
        if (width <= 1200) return 3;
        return 4;
    }
    
    addItem(element) {
        // 새 행이 필요한지 확인
        if (!this.currentRow || this.itemsInCurrentRow >= this.itemsPerRow) {
            this.createNewRow();
        }
        
        this.currentRow.appendChild(element);
        this.itemsInCurrentRow++;
    }
    
    createNewRow() {
        this.currentRow = document.createElement('div');
        this.currentRow.className = 'gallery-row';
        this.container.appendChild(this.currentRow);
        this.itemsInCurrentRow = 0;
    }
    
    clear() {
        this.container.innerHTML = '';
        this.currentRow = null;
        this.itemsInCurrentRow = 0;
    }
    
    handleResize() {
        const newItemsPerRow = this.getItemsPerRow();
        if (newItemsPerRow !== this.itemsPerRow) {
            this.itemsPerRow = newItemsPerRow;
            this.relayout();
        }
    }
    
    relayout() {
        // 모든 아이템 수집
        const allItems = Array.from(this.container.querySelectorAll('.gallery-item'));
        
        // 컨테이너 초기화
        this.clear();
        
        // 아이템들을 새로운 행 구조로 재배치
        allItems.forEach(item => {
            this.addItem(item);
        });
    }
}

let gridInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    // 그리드 인스턴스 생성
    const gallery = document.getElementById('gallery');
    if (!gallery) {
        console.error('Gallery container not found!');
        return;
    }
    
    gridInstance = new RowGridLayout(gallery);
    
    // 초기 이미지 로드
    loadImages(true);
    
    // 정렬 버튼 이벤트
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.classList.contains('active')) return;
            
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentSort = this.dataset.sort;
            currentPage = 1;
            hasMore = true;
            gridInstance.clear();
            loadImages(true);
        });
    });
    
    // 스크롤 이벤트
    let ticking = false;
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && !ticking) {
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
            await appendImagesWithGrid(data.images);
            
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

async function appendImagesWithGrid(images) {
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
                            <span class="like-count clickable-like" data-image-id="${image.id}" onclick="quickLike(event, '${image.id}')">❤️ ${image.likes || 0}</span>
                        </div>
                        <div class="image-prompt">
                            <p>${image.prompt && image.prompt.length > 50 ? image.prompt.substring(0, 50) + '...' : (image.prompt || '')}</p>
                        </div>
                    </div>
                </div>
            `;
            
            // 그리드에 추가
            gridInstance.addItem(galleryItem);
            
            // 이미지 미리 로드
            const img = galleryItem.querySelector('img');
            const container = galleryItem.querySelector('.image-container');
            const loadingText = galleryItem.querySelector('.image-loading-text');
            
            const preloadImg = new Image();
            preloadImg.onload = () => {
                // 이미지 비율 계산
                const ratio = preloadImg.width / preloadImg.height;
                
                // 비율에 따라 클래스 추가
                if (ratio > 1.3) {
                    container.classList.add('landscape');
                } else if (ratio < 0.8) {
                    container.classList.add('portrait');
                } else {
                    container.classList.add('square');
                }
                
                img.src = image.result_image;
                img.style.display = 'block';
                
                setTimeout(() => {
                    img.classList.add('loaded');
                    container.classList.remove('loading');
                    container.classList.add('loaded');
                    if (loadingText) loadingText.remove();
                    
                    // 클릭 이벤트 추가
                    galleryItem.onclick = () => openModal(image.id);
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
            
            setTimeout(() => {
                preloadImg.src = image.result_image;
            }, index * 50);
        });
    });
    
    return Promise.resolve();
}

// 나머지 함수들 (openModal, closeModal, likeImage, formatDate)는 기존과 동일하게 유지
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
    if (data.user_liked) {
        likeBtn.classList.add('liked', 'disabled');
    } else {
        likeBtn.classList.remove('liked', 'disabled');
    }

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
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
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

// 갤러리에서 바로 좋아요 누르기
async function quickLike(event, imageId) {
    event.stopPropagation(); // 모달 열리지 않게 방지
    
    const likeElement = event.target;
    if (likeElement.classList.contains('liked') || likeElement.classList.contains('processing')) {
        return; // 이미 좋아요 누름 or 처리 중
    }
    
    likeElement.classList.add('processing');
    
    try {
        const response = await fetch(`/like/${imageId}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.success) {
            // 좋아요 수 업데이트
            likeElement.textContent = `❤️ ${data.likes}`;
            likeElement.classList.add('liked');
            
            // 다른 동일한 이미지들도 업데이트
            document.querySelectorAll(`[data-image-id="${imageId}"]`).forEach(el => {
                el.textContent = `❤️ ${data.likes}`;
                el.classList.add('liked');
            });
            
            console.log(`✅ 좋아요 성공: ${imageId} -> ${data.likes}개`);
        } else {
            if (data.already_liked) {
                likeElement.classList.add('liked');
                alert('이미 좋아요를 누른 이미지입니다!');
            } else {
                alert(data.error || '좋아요 처리 중 오류가 발생했습니다.');
            }
        }
    } catch (error) {
        console.error('좋아요 오류:', error);
        alert('좋아요 처리 중 오류가 발생했습니다.');
    } finally {
        likeElement.classList.remove('processing');
    }
}
