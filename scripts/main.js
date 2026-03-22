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

        html.find('.nav-item').click(ev => {
            html.find('.nav-item').removeClass('active');
            $(ev.currentTarget).addClass('active');
            const targetScreen = $(ev.currentTarget).data('target');
            html.find('.phone-screen').hide();
            html.find('#' + targetScreen).show();

            if(targetScreen === 'screen-list') this.loadContactList(html);
            if(targetScreen === 'screen-chatlist') this.loadChatList(html);
            if(targetScreen === 'screen-bank') {
                checkPendingTransfers(); // 🔥 은행 탭을 누를 때마다 입금 확인!
                this.updateBankScreen(html); 
            }
        });

        // 🌟 바탕화면 앱 아이콘 클릭 이벤트
        html.find('.app-icon').click(ev => {
            const targetScreen = $(ev.currentTarget).data('target');
            
            // 모든 화면 숨기고 누른 앱 화면 켜기
            html.find('.phone-screen').hide();
            html.find('#' + targetScreen).show();

            // 밑의 하단 네비게이션 바도 누른 앱에 맞춰서 불 들어오게 하기
            html.find('.nav-item').removeClass('active');
            const navTarget = html.find(`.nav-item[data-target="${targetScreen}"]`);
            if(navTarget.length) navTarget.addClass('active');

            // 기능 로드 연결
            if(targetScreen === 'screen-list') this.loadContactList(html);
            if(targetScreen === 'screen-bank') {
                checkPendingTransfers();
                this.updateBankScreen(html); 
            }
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

        html.find('.btn-back').click(() => { 
            html.find('#screen-profile').hide(); html.find('#screen-chat').hide(); 
            const activeTab = html.find('.nav-item.active').data('target');
            html.find('#' + activeTab).show();
            if(activeTab === 'screen-list') this.loadContactList(html);
            if(activeTab === 'screen-chatlist') this.loadChatList(html);
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
}
window.GundogSmartphoneApp = SmartphoneApp;