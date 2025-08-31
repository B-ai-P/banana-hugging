let currentImageId = null;
let userLikedImages = new Set();
let currentPage = 1;
let currentSort = 'newest';
let isLoading = false;
let hasMore = true;

document.addEventListener('DOMContentLoaded', function() {
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
            document.getElementById('gallery').innerHTML = '';
            loadImages(true);
        });
    });
    
    // 스크롤 이벤트 (더 부드럽게)
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
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
            // 스켈레톤 먼저 표시하고 이미지 로드
            await appendImagesWithSkeleton(data.images);
            
            // 상태 업데이트
            hasMore = data.has_more;
            currentPage++;
            
            // 빈 갤러리 메시지 숨기기
            emptyGallery.classList.add('hidden');
            
            // 더 이상 이미지가 없으면 끝 메시지 표시
            if (!hasMore) {
                endMessage.classList.remove('hidden');
            }
        } else if (isInitial) {
            // 초기 로드에서 이미지가 없으면 빈 갤러리 표시
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

async function appendImagesWithSkeleton(images) {
    const gallery = document.getElementById('gallery');
    
    // 스켈레톤과 실제 이미지를 동시에 처리
    const imagePromises = images.map(async (image, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        // 스켈레톤을 먼저 표시
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
        
        gallery.appendChild(galleryItem);
        
        // 이미지 미리 로드
        return new Promise((resolve) => {
            const img = galleryItem.querySelector('img');
            const container = galleryItem.querySelector('.image-container');
            const loadingText = galleryItem.querySelector('.image-loading-text');
            
            const preloadImg = new Image();
            preloadImg.onload = () => {
                // 이미지 로드 완료 시 부드럽게 전환
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
                // 이미지 로드 실패 시
                loadingText.textContent = '로드 실패';
                loadingText.style.color = '#ef4444';
                container.classList.remove('loading');
                resolve();
            };
            
            // 실제 이미지 로드 시작 (약간 지연으로 자연스럽게)
            setTimeout(() => {
                preloadImg.src = image.result_image;
            }, index * 100); // 0.1초씩 지연해서 자연스럽게
        });
    });
    
    // 모든 이미지 로딩 완료까지 기다리지 않고 바로 리턴
    // (백그라운드에서 계속 로딩됨)
}

async function openModal(imageId) {
    currentImageId = imageId;
    
    try {
        const response = await fetch(`/image/${imageId}`);
        const data = await response.json();

        if (response.ok) {
            // 모달 이미지도 미리 로드
            const modalImg = document.getElementById('modalImage');
            const preloadImg = new Image();
            
            preloadImg.onload = () => {
                modalImg.src = data.result_image;
                modalImg.style.opacity = '1';
            };
            
            // 모달 내용 채우기
            modalImg.style.opacity = '0.5'; // 로딩 중 표시
            preloadImg.src = data.result_image;
            
            document.getElementById('modalDate').textContent = formatDate(data.created_at);
            document.getElementById('likeCount').textContent = data.likes;
            document.getElementById('modalPrompt').textContent = data.prompt;
            document.getElementById('modalResponse').textContent = data.response_text || 'AI가 이미지를 생성했습니다.';

            // 좋아요 버튼 상태 업데이트
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

            // 첨부 이미지들 표시
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
