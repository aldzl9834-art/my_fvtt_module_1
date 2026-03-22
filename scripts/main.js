class SmartphoneApp extends Application {
    constructor(actor) {
        super();
        this.myActor = actor;
        this.myUserId = "user_" + actor.id; 
        this.currentRoomId = "";     
        this.currentTargetId = "";   
        this.apiUrl = `http://${window.location.hostname}:8090/gundog_api`;
    }

    static get defaultOptions() {
        // 🔥 FVTT V12 호환성 해결: foundry.utils 를 반드시 붙여야 합니다.
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "gundog-smartphone-app",
            title: "📱 마르피사 건독 스마트폰",
            template: "modules/marpisa-gundog-smartphone/templates/app.html",
            width: 400, height: 600, resizable: false
        });
    }

    getRoomId(id1, id2) { return [id1, id2].sort().join("_"); }

    activateListeners(html) {
        super.activateListeners(html);

        // 🌟 마스터(최고 권한 4)일 경우에만 관리자 앱 아이콘을 띄웁니다.
        if (game.user.role === 4) {
            html.find('#icon-admin').show();
        }
        // --- 🌟 우체통 확인 함수 (나에게 온 돈이 있으면 내 시트에 더합니다) ---
        const checkPendingTransfers = () => {
            fetch(`${this.apiUrl}/api_receive_money.php?my_id=${this.myUserId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" && data.total_amount > 0) {
                    const receivedAmount = Number(data.total_amount);
                    const myBankStr = String(this.myActor.system?.profile?.wealth?.bank || "0").replace(/,/g, '');
                    const myBank = Number(myBankStr) || 0;
                    const newMyBank = String(myBank + receivedAmount);

                    // 내 시트에 들어온 돈 더하기 (자신의 시트이므로 100% 성공!)
                    this.myActor.update({ "system.profile.wealth.bank": newMyBank }).then(() => {
                        if (!this.myActor.isToken) {
                            this.myActor.getActiveTokens().forEach(t => {
                                if (t.document && !t.document.isLinked) t.actor.update({ "system.profile.wealth.bank": newMyBank });
                            });
                        }
                        ui.notifications.info(`🏦 [마르피사 은행] 입금액 ${receivedAmount.toLocaleString()}원이 통장에 추가되었습니다!`);
                        this.updateBankScreen(html); // 화면 갱신
                    });
                }
            });
        };

        // 1. 앱을 켤 때 우체통 한 번 확인!
        checkPendingTransfers();
        const formData = new FormData();
        formData.append("actor_id", this.myActor.id);
        formData.append("name", this.myActor.name);
        fetch(`${this.apiUrl}/api_init_user.php`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            if(data.status === "success") {
                html.find('#my-profile-name').text(data.data.name);
                html.find('#my-profile-img').attr('src', data.data.profile_image_url);
                this.loadContactList(html); 
            }
        });

        // 🌟 [시스템] 스마트폰 소프트키 (네비게이션 바) 로직
    
    // 화면 이동 통합 함수 (네비게이션 바 불빛 조절 포함)
    const navigateTo = (targetId) => {
        // 모든 화면 숨기고 목표 화면 켜기
        html.find('.phone-screen').hide();
        html.find('#' + targetId).show();
        
        // 홈 화면일 때만 홈버튼 불 켜기, 아니면 끄기
        if(targetId === 'screen-home') {
            html.find('.bottom-nav .nav-item').removeClass('active');
            html.find('.btn-home-key').addClass('active');
        } else {
            html.find('.bottom-nav .nav-item').removeClass('active');
        }
    };

    // 1. ≡ 최근 앱 버튼
    // 1. ≡ 최근 앱 버튼 (임시로 메신저 화면으로 연결)
    html.find('.btn-recent-apps').click(ev => {
        navigateTo('screen-list'); // 메신저(연락처) 화면으로 이동
        this.loadContactList(html); // 연락처 목록 새로고침
    });

    // 2. ◯ 홈 버튼
    html.find('.btn-home-key').click(ev => {
        navigateTo('screen-home'); // 무조건 홈 화면으로
    });

    // 3. ◀ 뒤로 가기 버튼 (똑똑한 로직)
    html.find('.btn-back-key').click(ev => {
        // 현재 열려있는(display:block 인) 화면의 ID를 찾습니다.
        const currentScreenId = html.find('.phone-screen:visible').attr('id');
        
        if (!currentScreenId || currentScreenId === 'screen-home') {
            // 홈 화면이거나 화면이 없으면 반응하지 않음
            return;
        }

        // 현재 화면에 따른 뒤로 가기 경로 지정
        switch (currentScreenId) {
            case 'screen-chat': // 채팅방 안에 있다면
                navigateTo('screen-chatlist'); // 대화 목록으로 이동
                this.loadChatList(html); // 목록 갱신
                break;
            case 'screen-profile': // 프로필 화면 안에 있다면
                navigateTo('screen-list'); // 연락처 목록으로 이동
                break;
            case 'screen-list': // 메인 앱(연락처, 대화목록, 은행, 브라우저) 화면들이면
            case 'screen-chatlist':
            case 'screen-bank':
            case 'screen-browser':
                navigateTo('screen-home'); // 무조건 홈 화면으로 이동
                break;
            case 'screen-board-read':
            case 'screen-board-write':
                MapsTo('screen-browser');
                this.loadBoardList(html);
                break;
            default:
                // 알 수 없는 화면이면 홈 화면으로
                navigateTo('screen-home');
                break;
        }
    });

    // 🌟 // 🌟 [게시판] 전체글 버튼 클릭 (모아보기 해제)
        html.find('#btn-board-all').click(() => {
            this.loadBoardList(html); 
        });

        // 🌟 [게시판] 고정닉 로그인/설정 버튼
        html.find('#btn-board-login').click(() => {
            const currentNick = this.myActor.getFlag('marpisa-gundog-smartphone', 'boardNickname') || '';
            new Dialog({
                title: "다크웹 고정 닉네임 설정",
                content: `
                    <p style="font-size:13px; color:#555;">다크웹에서 사용할 고정 닉네임을 설정합니다.<br>이름을 비우고 저장하면 <b>유동닉(ㅇㅇ)</b> 모드로 돌아갑니다.</p>
                    <input type="text" id="fixed-nick-input" value="${currentNick}" placeholder="원하는 닉네임 입력" style="width:100%; padding:8px; border-radius:4px; border:1px solid #ccc; margin-bottom:10px; font-weight:bold;">
                `,
                buttons: {
                    save: {
                        label: "저장하기",
                        callback: async (dHtml) => {
                            const newNick = dHtml.find('#fixed-nick-input').val().trim();
                            if (newNick) {
                                await this.myActor.setFlag('marpisa-gundog-smartphone', 'boardNickname', newNick);
                                ui.notifications.info(`✅ 갤러리 고정닉 [★${newNick}] 설정 완료!`);
                            } else {
                                await this.myActor.unsetFlag('marpisa-gundog-smartphone', 'boardNickname');
                                ui.notifications.info(`✅ 익명(유동닉) 모드로 전환되었습니다.`);
                            }
                        }
                    }
                }
            }).render(true);
        });

        // 🌟 [게시판] 글쓰기 화면 열기 (고정닉 적용)
        html.find('#btn-board-write').click(() => {
            const fixedNick = this.myActor.getFlag('marpisa-gundog-smartphone', 'boardNickname');
            
            html.find('.phone-screen').hide();
            html.find('#screen-board-write').show();
            html.find('#write-title').val('');
            html.find('#write-content').val('');
            html.find('#write-file').val('');
            html.find('#write-file-name').text('선택된 파일 없음');

            // 고정닉이 있다면 작성자 칸을 잠그고, 비밀번호 칸을 숨깁니다.
            if (fixedNick) {
                html.find('#write-author').val('★' + fixedNick).prop('readonly', true).css('background', '#ecf0f1');
                html.find('#write-pwd').hide();
                if(!html.find('#fixed-auth-label').length) {
                    html.find('#write-pwd').after('<span id="fixed-auth-label" style="flex:1; padding:8px; color:#2980b9; font-weight:bold; font-size:12px;">[고정닉 자동 인증됨]</span>');
                } else {
                    html.find('#fixed-auth-label').show();
                }
            } else {
                html.find('#write-author').val('ㅇㅇ').prop('readonly', false).css('background', '#fff');
                html.find('#write-pwd').val('').show();
                html.find('#fixed-auth-label').hide();
            }
        });

        // (중간의 상단 뒤로가기 버튼, 첨부파일 이벤트 등은 그대로 유지) ...

        // 🌟 [게시판] 글 등록(전송) 로직 (고정닉 연동)
        html.find('#btn-board-submit').click(() => {
            const fixedNick = this.myActor.getFlag('marpisa-gundog-smartphone', 'boardNickname');
            
            const title = html.find('#write-title').val().trim();
            const content = html.find('#write-content').val().trim();
            const author = fixedNick ? fixedNick : (html.find('#write-author').val().trim() || 'ㅇㅇ');
            const pwd = fixedNick ? this.myUserId : html.find('#write-pwd').val(); // 고정닉은 내 FVTT ID를 비밀번호로 씀
            const authorId = fixedNick ? this.myUserId : 'anonymous'; // 익명 여부 판별
            const file = html.find('#write-file')[0].files[0];

            if (!title || !content) return ui.notifications.warn("제목과 내용을 입력해야 합니다.");

            const formData = new FormData();
            formData.append('author_id', authorId);
            formData.append('author_name', author);
            formData.append('password', pwd);
            formData.append('title', title);
            formData.append('content', content);
            if (file) formData.append('file', file);

            ui.notifications.info("⏳ 글을 업로드합니다...");
            fetch(`${this.apiUrl}/api_board_write_post.php`, { method: "POST", body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    ui.notifications.info("✅ 업로드 완료!");
                    html.find('.phone-screen').hide();
                    html.find('#screen-browser').show();
                    this.loadBoardList(html);
                } else {
                    ui.notifications.error("업로드 실패: " + data.message);
                }
            });
        });

        // 🌟 [게시판] 댓글 달기 로직 (고정닉 연동)
        html.find('#btn-comment-submit').click(() => {
            const fixedNick = this.myActor.getFlag('marpisa-gundog-smartphone', 'boardNickname');

            const content = html.find('#comment-content').val().trim();
            const author = fixedNick ? fixedNick : (html.find('#comment-author').val().trim() || 'ㅇㅇ');
            const pwd = fixedNick ? this.myUserId : html.find('#comment-pwd').val();
            const authorId = fixedNick ? this.myUserId : 'anonymous';

            if (!content) return ui.notifications.warn("댓글 내용을 입력하세요.");
            if (!this.currentBoardPostId) return;

            const formData = new FormData();
            formData.append('post_id', this.currentBoardPostId);
            formData.append('author_id', authorId);
            formData.append('author_name', author);
            formData.append('password', pwd);
            formData.append('content', content);

            fetch(`${this.apiUrl}/api_board_write_comment.php`, { method: "POST", body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    html.find('#comment-content').val('');
                    this.viewBoardPost(html, this.currentBoardPostId);
                } else {
                    ui.notifications.error("댓글 등록 실패!");
                }
            });
        });

    // 🌟 바탕화면 앱 아이콘 클릭 이벤트 (여기서 navigateTo 함수를 사용하도록 수정)
    html.find('.app-icon').click(ev => {
        const targetScreen = $(ev.currentTarget).data('target');
        
        navigateTo(targetScreen); // 화면 이동

        // 기능 로드 연결
        if(targetScreen === 'screen-list') this.loadContactList(html);
        if(targetScreen === 'screen-bank') {
            if (typeof checkPendingTransfers === 'function') checkPendingTransfers(); // 은행이면 입금 확인
            this.updateBankScreen(html); 
        }
        if(targetScreen === 'screen-chatlist') this.loadChatList(html);
        if(targetScreen === 'screen-browser') this.loadBoardList(html);
    });

        html.find('#btn-open-transfer').click(() => {
            fetch(`${this.apiUrl}/api_get_contacts.php?my_id=${this.myUserId}`)
            .then(res => res.json())
            .then(data => {
                let options = `<option value="">-- 주소록에서 선택 --</option>`;
                if(data.data) { data.data.forEach(c => { options += `<option value="${c.id}">${c.name}</option>`; }); }

                new Dialog({
                    title: "송금하기",
                    content: `
                        <div style="margin-bottom: 15px;"><label style="font-size:12px; font-weight:bold; color:#555;">받는 사람 (주소록 선택)</label><select id="transfer-target-select" style="width: 100%; padding: 8px; border-radius:5px; border:1px solid #ccc;">${options}</select></div>
                        <div style="margin-bottom: 15px;"><label style="font-size:12px; font-weight:bold; color:#555;">또는 가상 ID 직접 입력</label><input type="text" id="transfer-target-manual" style="width: 100%; padding: 8px; border-radius:5px; border:1px solid #ccc;" placeholder="예: user_alpha"></div>
                        <div style="margin-bottom: 20px;"><label style="font-size:12px; font-weight:bold; color:#555;">송금할 금액</label><input type="text" id="transfer-amount" style="width: 100%; padding: 10px; border-radius:5px; border:2px solid #3498db; text-align: right; font-size: 18px; font-weight:bold;" placeholder="0"></div>
                    `,
                    render: (dHtml) => {
                        dHtml.find('#transfer-amount').on('input', function() {
                            let val = $(this).val().replace(/[^0-9]/g, ''); 
                            if(val) $(this).val(Number(val).toLocaleString()); 
                        });
                    },
                    buttons: {
                        next: {
                            label: "다음 (확인)",
                            callback: (dHtml) => {
                                const selectId = dHtml.find('#transfer-target-select').val();
                                const manualId = dHtml.find('#transfer-target-manual').val();
                                const targetId = manualId || selectId; 
                                const amountStr = dHtml.find('#transfer-amount').val();
                                const amount = parseInt(amountStr.replace(/,/g, ''), 10); 
                                
                                if(!targetId) return ui.notifications.warn("받는 사람을 지정해주세요.");
                                if(!amount || amount <= 0) return ui.notifications.warn("올바른 금액을 입력해주세요.");
                                
                                // 🔥 콤마 제거 후 잔고 확인
                                const myBank = Number(String(this.myActor.system.profile.wealth.bank || "0").replace(/,/g, '')) || 0;
                                if (amount > myBank) return ui.notifications.error(`잔액이 부족합니다. (현재 잔액: ${myBank.toLocaleString()}원)`);
                                
                                this.confirmTransfer(html, targetId, amount);
                            }
                        }
                    }
                }).render(true);
            });
        });

        const profileUpload = html.find('#my-profile-upload');
        html.find('#my-profile-img').click(() => { profileUpload.click(); });
        profileUpload.on("change", (ev) => {
            const file = ev.target.files[0];
            if (!file) return;
            const uploadData = new FormData();
            uploadData.append("my_id", this.myUserId);
            uploadData.append("file", file);
            fetch(`${this.apiUrl}/api_update_profile_image.php`, { method: "POST", body: uploadData })
            .then(res => res.json())
            .then(data => { if(data.status === "success") { html.find('#my-profile-img').attr('src', data.url); } });
        });

        html.find('#btn-my-id').click(() => {
            new Dialog({
                title: "내 연락처 정보",
                content: `<div style="padding:10px; text-align:center;"><p>상대방에게 아래의 아이디를 알려주세요.</p><input type="text" value="${this.myUserId}" readonly style="text-align:center; font-weight:bold; font-size:16px; padding:10px; border-radius:8px; width:90%;"></div>`,
                buttons: { close: { label: "확인" } }
            }).render(true);
        });

        html.find('#btn-add-contact').click(() => {
            new Dialog({
                title: "연락처 추가",
                content: `<p>가상 ID를 입력하세요.</p><input type="text" id="add-contact-id" style="margin-bottom:10px;">`,
                buttons: { add: { label: "추가", callback: (d) => { const tid = d.find('#add-contact-id').val(); if(tid) this.addContact(html, tid); } } }
            }).render(true);
        });

        const openInviteDialog = () => {
            fetch(`${this.apiUrl}/api_get_contacts.php?my_id=${this.myUserId}`)
            .then(res => res.json())
            .then(data => {
                if(!data.data || data.data.length === 0) return ui.notifications.warn("초대할 연락처가 없습니다.");
                let checkboxHtml = `<div style="max-height: 200px; overflow-y: auto; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 5px;">`;
                data.data.forEach(c => {
                    const isChecked = (c.id === this.currentTargetId) ? "checked" : "";
                    checkboxHtml += `<label style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer;"><input type="checkbox" name="group_members" value="${c.id}" ${isChecked} style="margin-right:10px;"><img src="${c.profile_image_url}" style="width:24px; height:24px; border-radius:50%; margin-right:8px;"> ${c.name}</label>`;
                });
                checkboxHtml += `</div>`;
                new Dialog({
                    title: "그룹 채팅 초대",
                    content: `<p>대화에 초대할 연락처를 선택하세요.</p>${checkboxHtml}<br>`,
                    buttons: {
                        create: {
                            label: "만들기",
                            callback: (dialogHtml) => {
                                const selected = [];
                                dialogHtml.find('input[name="group_members"]:checked').each(function() { selected.push($(this).val()); });
                                if(selected.length === 0) return ui.notifications.warn("한 명 이상 선택해야 합니다.");
                                const formData = new FormData();
                                formData.append("my_id", this.myUserId);
                                formData.append("members", JSON.stringify(selected));
                                fetch(`${this.apiUrl}/api_create_group.php`, { method: "POST", body: formData })
                                .then(res => res.json())
                                .then(resData => {
                                    if(resData.status === "success") {
                                        this.currentRoomId = resData.room_id;
                                        this.currentTargetId = resData.room_id;
                                        html.find('.phone-screen').hide();
                                        html.find('#screen-chat').show();
                                        this.loadMessages(html, this.currentRoomId);
                                    }
                                });
                            }
                        }
                    }
                }).render(true);
            });
        };
        html.find('#btn-new-group').click(openInviteDialog);
        html.find('#btn-invite-group').click(openInviteDialog);

        // 🌟 [수정] 상단 좌측 뒤로가기 버튼 로직 (프로필/채팅방 닫기)
        html.find('.btn-back').click(ev => { 
            const currentScreenId = $(ev.currentTarget).closest('.phone-screen').attr('id');
            html.find('.phone-screen').hide();
            
            if (currentScreenId === 'screen-chat') {
                html.find('#screen-chatlist').show(); // 대화창에서 나가면 대화 목록으로
                this.loadChatList(html);
            } else if (currentScreenId === 'screen-profile') {
                html.find('#screen-list').show(); // 프로필에서 나가면 연락처로
            }
        });

        // 🌟 [추가] 메신저 상단 탭 (연락처 / 대화창) 전환 로직
        html.find('.msg-tab').click(ev => {
            const targetScreen = $(ev.currentTarget).data('target');
            
            // 모든 화면 숨기고 누른 탭 화면 켜기
            html.find('.phone-screen').hide();
            html.find('#' + targetScreen).show();

            // 기능 로드
            if(targetScreen === 'screen-list') this.loadContactList(html);
            if(targetScreen === 'screen-chatlist') this.loadChatList(html);
        });
        
        html.find('#btn-open-chat').click(() => {
            html.find('#screen-profile').hide(); html.find('#screen-chat').show();
            this.currentRoomId = this.getRoomId(this.myUserId, this.currentTargetId);
            this.loadMessages(html, this.currentRoomId); 
        });

        const chatInput = html.find('#chat-input');
        chatInput.on('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
        chatInput.on('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); html.find('#btn-send').click(); } });

        html.find('#btn-send').click(() => {
            const messageText = chatInput.val().trim();
            if(!messageText) return;
            const sendData = new FormData();
            sendData.append("room_id", this.currentRoomId);
            sendData.append("sender_id", this.myUserId);
            sendData.append("message_type", "text");
            sendData.append("content", messageText);
            fetch(`${this.apiUrl}/api_send_message.php`, { method: "POST", body: sendData })
            .then(() => { chatInput.val(""); chatInput.css('height', '40px'); this.loadMessages(html, this.currentRoomId); });
        });

        const fileInput = html.find('#file-input');
        html.find('#btn-image').click(() => { fileInput.click(); });
        fileInput.on("change", (ev) => {
            const file = ev.target.files[0];
            if (!file) return;
            const imgData = new FormData();
            imgData.append("room_id", this.currentRoomId);
            imgData.append("sender_id", this.myUserId);
            imgData.append("file", file);
            fetch(`${this.apiUrl}/api_upload_image.php`, { method: "POST", body: imgData })
            .then(() => { fileInput.val(""); this.loadMessages(html, this.currentRoomId); });
        });
        
        // 🌟 [관리자] 다크웹 강제 진입 버튼
        html.find('#btn-admin-bypass').click(() => {
            ui.notifications.info("🕵️ 관리자 권한으로 다크웹 시스템에 강제 접속합니다.");
            navigateTo('screen-browser');
            this.loadBoardList(html);
        });

        // 🌟 [게시판] 글 수정 및 삭제 버튼 연결
        html.find('#btn-post-delete').click(() => this.promptBoardAction(html, 'delete_post', this.currentBoardPostId));
        html.find('#btn-post-edit').click(() => this.promptBoardAction(html, 'edit_post', this.currentBoardPostId));

        // 🌟 [게시판] 동적으로 생성된 댓글 '삭제' 버튼 이벤트 연결
        html.find('#comment-list').on('click', '.btn-delete-comment', (ev) => {
            const cid = $(ev.currentTarget).data('id');
            this.promptBoardAction(html, 'delete_comment', cid);
        });
    }

    updateBankScreen(html) {
        // 🔥 화면에 표시할 때도 콤마를 지우고 순수 숫자로 만든 뒤 다시 예쁘게 콤마를 찍어 보여줍니다.
        const currentBank = Number(String(this.myActor.system.profile.wealth.bank || "0").replace(/,/g, '')) || 0;
        html.find('#my-bank-balance').text(currentBank.toLocaleString() + " 원");
    }

    confirmTransfer(html, targetUserId, amount) {
        fetch(`${this.apiUrl}/api_get_user_info.php?user_id=${targetUserId}`)
        .then(res => res.json())
        .then(data => {
            if(data.status !== "success") return ui.notifications.error("대상을 찾을 수 없거나 탈퇴한 사용자입니다.");
            const targetName = data.data.name;
            const targetActorId = data.data.actor_id;

            new Dialog({
                title: "송금 최종 확인",
                content: `<div style="text-align: center; padding: 20px;"><h3 style="color: #e74c3c; margin-top: 0;">⚠️ 이체 확인</h3><p style="font-size: 16px;"><strong>[${targetName}]</strong> 님에게</p><p style="font-size: 28px; font-weight: bold; color: #3498db; margin: 15px 0;">${amount.toLocaleString()} 원</p><p style="font-size: 14px; color: #7f8c8d;">을 정말로 송금하시겠습니까?<br>이 작업은 되돌릴 수 없습니다.</p></div>`,
                buttons: { yes: { icon: '<i class="fas fa-check"></i>', label: "예 (송금 진행)", callback: () => { this.executeTransfer(html, targetActorId, amount, targetName, targetUserId); } }, no: { icon: '<i class="fas fa-times"></i>', label: "아니오" } }, default: "no"
            }).render(true);
        });
    }

   // 진짜로 FVTT 캐릭터 시트 데이터 수정하기 (SQL 우체통 방식)
    executeTransfer(html, targetActorId, amount, targetName, targetUserId) {
        const myBankStr = String(this.myActor.system?.profile?.wealth?.bank || "0").replace(/,/g, '');
        const myBank = Number(myBankStr) || 0;
        const numAmount = Number(amount) || 0;

        if (myBank < numAmount) return ui.notifications.error("잔액이 부족합니다.");

        // 1. 내 시트에서 내 돈 깎기 (자신의 시트이므로 무조건 100% 성공!)
        const newMyBank = String(myBank - numAmount);
        this.myActor.update({ "system.profile.wealth.bank": newMyBank }).then(() => {
            if (!this.myActor.isToken) {
                this.myActor.getActiveTokens().forEach(t => {
                    if (t.document && !t.document.isLinked) t.actor.update({ "system.profile.wealth.bank": newMyBank });
                });
            }

            // 2. SQL 우체통에 돈 넣기 (API 호출)
            const formData = new FormData();
            formData.append("target_id", targetUserId);
            formData.append("amount", numAmount);

            fetch(`${this.apiUrl}/api_send_money.php`, { method: "POST", body: formData }).then(() => {
                ui.notifications.info(`✅ ${targetName}님에게 ${numAmount.toLocaleString()}원을 송금했습니다.`);
                this.updateBankScreen(html);

                // 영수증 채팅 발송
                const roomId = this.getRoomId(this.myUserId, targetUserId);
                const msg = `💸 [송금 알림]\n${numAmount.toLocaleString()} 원이 안전하게 이체되었습니다.`;
                const sendData = new FormData();
                sendData.append("room_id", roomId);
                sendData.append("sender_id", this.myUserId);
                sendData.append("message_type", "text");
                sendData.append("content", msg);
                fetch(`${this.apiUrl}/api_send_message.php`, { method: "POST", body: sendData });
            });
        }).catch(err => ui.notifications.error("내 잔고 업데이트에 실패했습니다."));
    }

    addContact(html, targetId) {
        const formData = new FormData(); formData.append("owner_id", this.myUserId); formData.append("contact_id", targetId);
        fetch(`${this.apiUrl}/api_add_addressbook.php`, { method: "POST", body: formData })
        .then(res => res.json()).then(data => { if(data.status === "success") { ui.notifications.info(data.message); this.loadContactList(html); } else { ui.notifications.error(data.message); } });
    }

    loadContactList(html) {
        fetch(`${this.apiUrl}/api_get_contacts.php?my_id=${this.myUserId}`)
        .then(res => res.json()).then(data => {
            const container = html.find('#contact-list-container'); container.empty();
            if(data.data) {
                data.data.forEach(contact => {
                    const unreadBadge = contact.unread_count > 0 ? `<div class="unread-badge">${contact.unread_count}</div>` : '';
                    const itemHtml = `<div class="contact-item" data-id="${contact.id}" data-name="${contact.name}" data-img="${contact.profile_image_url}"><img src="${contact.profile_image_url}" class="profile-thumb"><div style="display:flex; flex-direction:column; flex-grow:1; overflow:hidden;"><span class="contact-name" style="font-weight:bold;">${contact.name}</span><span style="font-size:12px; color:#7f8c8d; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${contact.last_message}</span></div><div style="display:flex; flex-direction:column; align-items:flex-end; min-width:40px; gap:4px;"><span style="font-size:11px; color:#bdc3c7;">${contact.last_time}</span>${unreadBadge}</div></div>`;
                    container.append(itemHtml);
                });
                html.find('#contact-list-container .contact-item').click(ev => {
                    const target = $(ev.currentTarget); this.currentTargetId = target.data("id"); 
                    html.find('#profile-img-large').attr('src', target.data("img")); html.find('#profile-name-large').text(target.data("name")); html.find('#chat-room-name').text(target.data("name"));
                    html.find('.phone-screen').hide(); html.find('#screen-profile').show();
                });
            }
        });
    }

    // 🌟 게시판 목록 불러오기 (모아보기 기능 추가)
    loadBoardList(html, filterAuthorId = '') {
        const url = filterAuthorId ? `${this.apiUrl}/api_board_get_posts.php?author_id=${filterAuthorId}` : `${this.apiUrl}/api_board_get_posts.php`;
        
        // 모아보기 상태일 땐 제목을 바꾸고 '전체글' 버튼을 표시
        if (filterAuthorId) {
            html.find('#btn-board-all').show();
            html.find('#board-main-title').text('유저 작성글');
        } else {
            html.find('#btn-board-all').hide();
            html.find('#board-main-title').text('다크웹 익명 갤러리');
        }

        fetch(url)
        .then(res => res.json())
        .then(data => {
            const container = html.find('#board-list-container');
            container.empty();
            if (data.status === "success" && data.data && data.data.length > 0) {
                data.data.forEach(post => {
                    const commentTag = post.comment_count > 0 ? `<span class="board-comments">[${post.comment_count}]</span>` : '';
                    
                    // 🌟 고정닉 판별: author_id가 'anonymous'가 아니면 고정닉!
                    const isFixed = post.author_id && post.author_id !== 'anonymous';
                    const authorSpan = isFixed 
                        ? `<span class="board-author fixed-nick" data-author-id="${post.author_id}" style="color:#9b59b6; cursor:pointer; text-decoration:underline;" title="이 유저의 글 모아보기">★${post.author_name}</span>` 
                        : `<span class="board-author">${post.author_name}</span>`;

                    const itemHtml = `
                        <div class="board-item" data-id="${post.id}">
                            <div class="board-title">${post.title} ${commentTag}</div>
                            <div class="board-info">
                                ${authorSpan}
                                <span>${post.created_at} | 조회 ${post.view_count}</span>
                            </div>
                        </div>
                    `;
                    container.append(itemHtml);
                });
                
                // 글 클릭 시 읽기 화면으로 이동
                html.find('.board-item').click(ev => {
                    const postId = $(ev.currentTarget).data('id');
                    this.viewBoardPost(html, postId);
                });

                // 고정닉 클릭 시 모아보기 실행 (글 읽기로 넘어가는 것 방지)
                html.find('.fixed-nick').click(ev => {
                    ev.stopPropagation(); 
                    const aId = $(ev.currentTarget).data('author-id');
                    this.loadBoardList(html, aId);
                });

            } else {
                container.append('<div style="padding: 30px; text-align: center; color: #bdc3c7; font-size: 13px;">등록된 글이 없습니다.</div>');
            }
        });
    }

    // 🌟 게시판 글 읽기
    viewBoardPost(html, postId) {
        this.currentBoardPostId = postId; 
        
        fetch(`${this.apiUrl}/api_board_get_post_detail.php?post_id=${postId}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                const post = data.post;
                this.currentBoardAuthorId = post.author_id; // 🔥 내가 쓴 글인지 판별하기 위해 저장

                html.find('#read-title').text(post.title);
                html.find('#read-date-view').text(`${post.created_at.substring(5,16)} | 조회 ${post.view_count}`);
                html.find('#read-content').html(post.content.replace(/\n/g, '<br>'));
                
                // 🌟 본문 고정닉 처리
                const isFixed = post.author_id && post.author_id !== 'anonymous';
                const authorSpan = isFixed 
                    ? `<span class="fixed-nick" data-author-id="${post.author_id}" style="color:#9b59b6; cursor:pointer; text-decoration:underline;" title="글 모아보기">★${post.author_name}</span>` 
                    : `<span>${post.author_name}</span>`;
                html.find('#read-author').html(authorSpan);

                // 고정닉 클릭 시 목록(모아보기)으로 이동
                html.find('#read-author .fixed-nick').click(ev => {
                    const aId = $(ev.currentTarget).data('author-id');
                    html.find('.phone-screen').hide();
                    html.find('#screen-browser').show();
                    this.loadBoardList(html, aId);
                });

                if (post.image_url) {
                    html.find('#read-image').attr('src', post.image_url).show();
                } else {
                    html.find('#read-image').hide();
                }
                
                // 🌟 댓글 영역 (고정닉일 경우 비밀번호 입력창 자동 숨김 처리)
                const comments = data.comments || [];
                html.find('#read-comment-count').text(comments.length);
                const cList = html.find('#comment-list');
                cList.empty();
                comments.forEach(c => {
                    const delBtn = `<button class="btn-delete-comment" data-id="${c.id}" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:11px; padding:0; margin-left:5px;">[삭제]</button>`;
                    cList.append(`
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">${c.author_name} ${delBtn}</span>
                                <span class="comment-date">${c.created_at}</span>
                            </div>
                            <div class="comment-content">${c.content.replace(/\n/g, '<br>')}</div>
                        </div>
                    `);
                });

                // 🔥 고정닉 여부에 따라 댓글 입력창 UI 조절
                const myFixedNick = this.myActor.getFlag('marpisa-gundog-smartphone', 'boardNickname');
                if (myFixedNick) {
                    html.find('#comment-author').val(myFixedNick).prop('readonly', true).css({background: '#ecf0f1', width: '100%'});
                    html.find('#comment-pwd').hide();
                } else {
                    html.find('#comment-author').val('ㅇㅇ').prop('readonly', false).css({background: '#fff', width: '40%'});
                    html.find('#comment-pwd').val('').show();
                }
                
                html.find('.phone-screen').hide();
                html.find('#screen-board-read').show();
            }
        });
    }

    loadChatList(html) {
        fetch(`${this.apiUrl}/api_get_chatlist.php?my_id=${this.myUserId}`)
        .then(res => res.json()).then(data => {
            const container = html.find('#chatlist-container'); container.empty();
            if(data.data) {
                data.data.forEach(chat => {
                    const unreadBadge = chat.unread_count > 0 ? `<div class="unread-badge">${chat.unread_count}</div>` : '';
                    const itemHtml = `<div class="contact-item chat-room-item" data-id="${chat.target_id}" data-name="${chat.name}"><img src="${chat.profile_image_url}" class="profile-thumb"><div style="display:flex; flex-direction:column; flex-grow:1; overflow:hidden;"><span class="contact-name" style="font-weight:bold;">${chat.name}</span><span style="font-size:12px; color:#7f8c8d; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.last_message}</span></div><div style="display:flex; flex-direction:column; align-items:flex-end; min-width:40px; gap:4px;"><span style="font-size:11px; color:#bdc3c7;">${chat.last_time}</span>${unreadBadge}</div></div>`;
                    container.append(itemHtml);
                });
                html.find('.chat-room-item').click(ev => {
                    const target = $(ev.currentTarget); const targetId = target.data("id"); this.currentTargetId = targetId; 
                    html.find('#chat-room-name').text(target.data("name"));
                    html.find('.phone-screen').hide(); html.find('#screen-chat').show();
                    if (targetId.toString().startsWith("group_")) { this.currentRoomId = targetId; } else { this.currentRoomId = this.getRoomId(this.myUserId, targetId); }
                    this.loadMessages(html, this.currentRoomId); 
                });
            }
        });
    }

    loadMessages(html, roomId) {
        const markReadData = new FormData(); markReadData.append("room_id", roomId); markReadData.append("my_id", this.myUserId);
        fetch(`${this.apiUrl}/api_mark_read.php`, { method: "POST", body: markReadData });

        fetch(`${this.apiUrl}/api_get_messages_with_contacts.php?room_id=${roomId}`)
        .then(res => res.json()).then(data => {
            const chatDisplay = html.find('#chat-messages'); chatDisplay.empty(); 
            if(data.data) {
                let prevSenderId = null;
                data.data.forEach(msg => {
                    const isMe = msg.sender_id === this.myUserId;
                    const isConsecutive = prevSenderId === msg.sender_id; 
                    let contentHtml = msg.message_type === "text" ? msg.content.replace(/\n/g, "<br>") : `<img src="${msg.content}" style="max-width:100%; border-radius:5px;">`;
                    const rowClass = isConsecutive ? "msg-row consecutive" : "msg-row";
                    let msgHtml = isMe ? `<div class="${rowClass} me"><div class="msg-content-wrapper"><div class="chat-msg msg-me">${contentHtml}</div></div></div>` : `<div class="${rowClass} other"><img src="${msg.profile_image_url}" class="msg-profile-pic"><div class="msg-content-wrapper"><span class="msg-name">${msg.name}</span><div class="chat-msg msg-other">${contentHtml}</div></div></div>`;
                    chatDisplay.append(msgHtml);
                    prevSenderId = msg.sender_id;
                });
                chatDisplay.scrollTop(chatDisplay[0].scrollHeight);
            }
        });
    }
    // 🌟 [기능] 게시글/댓글 수정 및 삭제 다이얼로그 띄우기 (자동 인증 포함)
    promptBoardAction(html, action, targetId) {
        if (!targetId) return;
        const isAdmin = game.user.role === 4;
        
        // 내가 고정닉으로 쓴 내 글인지 확인 (댓글은 구조상 그냥 번거로우니 본인 패스워드나 관리자로 지우게 둡니다)
        let isMyFixedPost = false;
        if (action === 'edit_post' || action === 'delete_post') {
            isMyFixedPost = (this.currentBoardAuthorId === this.myUserId);
        }
        
        const skipPwd = isAdmin || isMyFixedPost;
        
        if (action === 'edit_post') {
            const currentTitle = html.find('#read-title').text();
            const currentContent = html.find('#read-content').html().replace(/<br>/g, '\n');
            const pwdInput = skipPwd ? `<p style="color:#3498db; font-weight:bold;">[권한 인증 완료됨]</p>` : `<div style="margin-bottom:10px;"><input type="password" id="action-pwd" placeholder="작성 시 입력한 비밀번호" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;"></div>`;
            
            new Dialog({
                title: "게시글 수정",
                content: `
                    ${pwdInput}
                    <div style="margin-bottom:10px;"><input type="text" id="action-title" value="${currentTitle}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;"></div>
                    <div style="margin-bottom:10px;"><textarea id="action-content" style="width:100%; height:150px; padding:8px; border:1px solid #ccc; border-radius:4px; resize:none; box-sizing:border-box; font-family:inherit;">${currentContent}</textarea></div>
                `,
                buttons: { save: { label: "수정 완료", callback: (dHtml) => {
                    const pwd = skipPwd ? (isAdmin ? '' : this.myUserId) : dHtml.find('#action-pwd').val();
                    const title = dHtml.find('#action-title').val();
                    const content = dHtml.find('#action-content').val();
                    this.executeBoardAction(html, 'edit_post', targetId, pwd, isAdmin, title, content);
                }}}
            }).render(true);
        } else {
            const typeName = action === 'delete_post' ? "게시글" : "댓글";
            const contentMsg = skipPwd 
                ? `<p style="color:#3498db; font-weight:bold;">[권한 인증 완료] 이 ${typeName}을(를) 삭제하시겠습니까?</p>` 
                : `<p>작성 시 입력한 비밀번호를 입력하세요.</p><input type="password" id="action-pwd" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; margin-bottom:10px;">`;
            
            new Dialog({
                title: `${typeName} 삭제`,
                content: contentMsg,
                buttons: { del: { label: "삭제", callback: (dHtml) => {
                    const pwd = skipPwd ? (isAdmin ? '' : this.myUserId) : dHtml.find('#action-pwd').val();
                    this.executeBoardAction(html, action, targetId, pwd, isAdmin);
                }}}
            }).render(true);
        }
    }

    // 🌟 [기능] 실제로 PHP 서버에 수정/삭제 요청 보내기
    executeBoardAction(html, action, targetId, pwd, isAdmin, title='', content='') {
        const fd = new FormData();
        fd.append('action', action);
        fd.append('target_id', targetId);
        fd.append('password', pwd);
        fd.append('is_admin', isAdmin ? 'true' : 'false');
        fd.append('title', title);
        fd.append('content', content);

        fetch(`${this.apiUrl}/api_board_manage.php`, { method: "POST", body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                ui.notifications.info("✅ 정상적으로 처리되었습니다.");
                if (action === 'delete_post') {
                    // 글을 지우면 목록으로 자동 이동
                    html.find('.phone-screen').hide();
                    html.find('#screen-browser').show();
                    this.loadBoardList(html);
                } else if (action === 'edit_post' || action === 'delete_comment') {
                    // 글을 수정하거나 댓글을 지우면 새로고침해서 보여줌
                    this.viewBoardPost(html, this.currentBoardPostId);
                }
            } else {
                ui.notifications.error("❌ 처리 실패: " + data.message);
            }
        });
    }

}
window.GundogSmartphoneApp = SmartphoneApp;