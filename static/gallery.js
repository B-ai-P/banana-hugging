let currentImageId = null;
let userLikedImages = new Set();

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});

async function openModal(imageId) {
    currentImageId = imageId;
    
    try {
        const response = await fetch(`/image/${imageId}`);
        const data = await response.json();

        if (response.ok) {
            // 모달 내용 채우기
            document.getElementById('modalImage').src = data.result_image;
            document.getElementById('modalDate').textContent = formatDate(data.created_at);
            document.getElementById('likeCount').textContent = data.likes;
            document.getElementById('modalPrompt').textContent = data.prompt;
            document.getElementById('modalResponse').textContent = data.response_text || 'AI가 이미지를 생성했습니다.';

            // 좋아요 버튼 상태 업데이트
            const likeBtn = document.getElementById('likeBtn');
            if (data.user_liked) {
                likeBtn.classList.add('liked', 'disabled');
                likeBtn.style.background = '#ff4757';
                likeBtn.style.borderColor = '#ff4757';
            } else {
                likeBtn.classList.remove('liked', 'disabled');
                likeBtn.style.background = '#2a2a2a';
                likeBtn.style.borderColor = '#444';
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
            likeBtn.style.background = '#ff4757';
            likeBtn.style.borderColor = '#ff4757';
            
            // 갤러리의 좋아요 수도 업데이트
            const galleryItems = document.querySelectorAll('.gallery-item');
            galleryItems.forEach(item => {
                if (item.getAttribute('onclick').includes(currentImageId)) {
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
