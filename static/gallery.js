document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    const closeBtn = document.querySelector('.close');
    const likeBtn = document.getElementById('likeBtn');

    // 모달 닫기
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    window.openModal = async function(imageId) {
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

                // 좋아요 버튼 설정
                likeBtn.onclick = () => likeImage(imageId);

                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            } else {
                alert('이미지 정보를 불러올 수 없습니다.');
            }
        } catch (error) {
            alert('오류가 발생했습니다: ' + error.message);
        }
    };

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async function likeImage(imageId) {
        try {
            const response = await fetch(`/like/${imageId}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                document.getElementById('likeCount').textContent = data.likes;
                // 갤러리 페이지의 좋아요 수도 업데이트
                const galleryItem = document.querySelector(`[onclick="openModal('${imageId}')"] .likes`);
                if (galleryItem) {
                    galleryItem.textContent = `❤️ ${data.likes}`;
                }
            }
        } catch (error) {
            console.error('좋아요 오류:', error);
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
});
