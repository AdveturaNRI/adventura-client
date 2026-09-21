import { apiMultipart, apiRequest } from '@/services/api/client';
import { CHAT_DICE_SKINS_ENABLED } from '@/utils/chat-dice-roll';
import { Platform } from 'react-native';
export const MAX_CHAT_ATTACHMENTS = 10;
export function normalizeMessageAttachments(message) {
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
        return message.attachments;
    }
    if (message.attachment) {
        return [message.attachment];
    }
    if (message.image) {
        const url = message.image.original ??
            message.image.large ??
            message.image.medium ??
            message.image.thumb ??
            null;
        return [
            {
                kind: 'image',
                name: 'Фото',
                mimeType: 'image/*',
                url,
                image: message.image,
            },
        ];
    }
    return [];
}
export function listConversations() {
    return apiRequest('/chats');
}
export function pinConversation(conversationId) {
    return apiRequest(`/chats/${conversationId}/pin`, {
        method: 'POST',
    });
}
export function unpinConversation(conversationId) {
    return apiRequest(`/chats/${conversationId}/pin`, {
        method: 'DELETE',
    });
}
export function reorderPinnedConversations(conversationIds) {
    return apiRequest('/chats/pins/order', {
        method: 'PUT',
        body: { conversationIds },
    });
}
export function openConversationWith(userId) {
    return apiRequest(`/chats/with/${userId}`, {
        method: 'POST',
    });
}
export function createGroupChat(title, memberIds) {
    return apiRequest('/chats/groups', {
        method: 'POST',
        body: { title, memberIds },
    });
}
export function openGameChat(gameId) {
    return apiRequest(`/chats/games/${encodeURIComponent(gameId)}`, {
        method: 'POST',
    });
}
export function listChatMembers(conversationId) {
    return apiRequest(`/chats/${conversationId}/members`);
}
export function renameGroupChat(conversationId, title) {
    return apiRequest(`/chats/${conversationId}`, {
        method: 'PUT',
        body: { title },
    });
}
export function addGroupMembers(conversationId, memberIds) {
    return apiRequest(`/chats/${conversationId}/members`, {
        method: 'POST',
        body: { memberIds },
    });
}
export function removeGroupMember(conversationId, userId) {
    return apiRequest(`/chats/${conversationId}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}
export function setGroupMemberRole(conversationId, userId, role) {
    return apiRequest(`/chats/${conversationId}/members/${encodeURIComponent(userId)}/role`, { method: 'PUT', body: { role } });
}
export function transferGroupOwnership(conversationId, userId) {
    return apiRequest(`/chats/${conversationId}/transfer`, {
        method: 'POST',
        body: { userId },
    });
}
export function deleteGroupChat(conversationId) {
    return apiRequest(`/chats/${conversationId}/group`, {
        method: 'DELETE',
    });
}
export function leaveGroup(conversationId) {
    return apiRequest(`/chats/${conversationId}/leave`, {
        method: 'POST',
    });
}
export function listMessages(conversationId, cursor) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return apiRequest(`/chats/${conversationId}/messages${query}`, {
        skipLoading: true,
    });
}
export function markConversationRead(conversationId) {
    return apiRequest(`/chats/${conversationId}/read`, {
        method: 'POST',
        skipLoading: true,
    });
}
export function deleteConversation(conversationId, forEveryone = false) {
    const query = forEveryone ? '?forEveryone=true' : '';
    return apiRequest(`/chats/${conversationId}${query}`, {
        method: 'DELETE',
    });
}
export function blockPeer(conversationId) {
    return apiRequest(`/chats/${conversationId}/block`, {
        method: 'POST',
    });
}
export function unblockPeer(conversationId) {
    return apiRequest(`/chats/${conversationId}/block`, {
        method: 'DELETE',
    });
}
export function unblockPeerByUserId(userId) {
    return apiRequest(`/chats/with/${encodeURIComponent(userId)}/block`, {
        method: 'DELETE',
    });
}
export async function setConversationBackground(conversationId, input) {
    const formData = new FormData();
    formData.append('kind', input.kind);
    if (input.kind === 'preset') {
        formData.append('presetId', input.presetId);
    }
    if (input.kind === 'custom') {
        const fileName = input.fileName ?? 'chat-bg.webp';
        const mimeType = input.mimeType ?? 'image/webp';
        if (Platform.OS === 'web') {
            const response = await fetch(input.fileUri);
            const blob = await response.blob();
            formData.append('file', blob, fileName);
        }
        else {
            formData.append('file', {
                uri: input.fileUri,
                name: fileName,
                type: mimeType,
            });
        }
    }
    return apiMultipart(`/chats/${conversationId}/background`, formData);
}
export async function sendChatMessage(conversationId, options) {
    const formData = new FormData();
    if (options.body?.trim()) {
        formData.append('body', options.body.trim());
    }
    if (options.replyToId?.trim()) {
        formData.append('replyToId', options.replyToId.trim());
    }
    if (options.voiceDurationSec) {
        formData.append('voiceDurationSec', String(Math.round(options.voiceDurationSec)));
    }
    if (options.voiceWaveform?.length) {
        formData.append('voiceWaveform', JSON.stringify(options.voiceWaveform));
    }
    const files = options.files && options.files.length > 0
        ? options.files
        : options.fileUri
            ? [
                {
                    uri: options.fileUri,
                    name: options.fileName ?? 'attachment',
                    mimeType: options.mimeType ?? 'application/octet-stream',
                },
            ]
            : [];
    for (const file of files) {
        const fileName = file.name || 'attachment';
        const mimeType = file.mimeType || 'application/octet-stream';
        if (Platform.OS === 'web') {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            formData.append('files', blob, fileName);
        }
        else {
            formData.append('files', {
                uri: file.uri,
                name: fileName,
                type: mimeType,
            });
        }
    }
    return apiMultipart(`/chats/${conversationId}/messages`, formData);
}
export async function sendChatDiceRoll(conversationId, options) {
    return apiRequest(`/chats/${conversationId}/dice-rolls`, {
        method: 'POST',
        body: {
            dice: options.dice,
            modifier: options.modifier ?? 0,
            hidden: Boolean(options.hidden),
            ...(options.color ? { color: options.color } : {}),
            ...(CHAT_DICE_SKINS_ENABLED && options.skin && options.skin !== 'standard'
                ? { skin: options.skin }
                : {}),
            ...(options.groups && options.groups.length > 0 ? { groups: options.groups } : {}),
            ...(options.mode && options.mode !== 'normal' ? { mode: options.mode } : {}),
        },
    });
}
export async function forwardChatMessages(targetConversationId, messageIds) {
    return apiRequest(`/chats/${targetConversationId}/forward`, {
        method: 'POST',
        body: { messageIds },
    });
}
export function createChatVoiceToken(conversationId) {
    return apiRequest(`/chats/${conversationId}/voice/token`, {
        method: 'POST',
    });
}
export function inviteChatVoiceCall(conversationId) {
    return apiRequest(`/chats/${conversationId}/voice/invite`, { method: 'POST' });
}
export function getActiveChatVoiceCall(conversationId) {
    return apiRequest(`/chats/${conversationId}/voice/active`, {
        skipLoading: true,
    });
}
export function acceptChatVoiceCall(conversationId, callId) {
    return apiRequest(`/chats/${conversationId}/voice/accept`, { method: 'POST', body: { callId } });
}
export function joinChatVoiceCall(conversationId, callId) {
    return apiRequest(`/chats/${conversationId}/voice/join`, { method: 'POST', body: callId ? { callId } : {} });
}
export function declineChatVoiceCall(conversationId, callId) {
    return apiRequest(`/chats/${conversationId}/voice/decline`, {
        method: 'POST',
        body: { callId },
    });
}
export function endChatVoiceCall(conversationId, callId) {
    return apiRequest(`/chats/${conversationId}/voice/end`, {
        method: 'POST',
        body: { callId },
    });
}
