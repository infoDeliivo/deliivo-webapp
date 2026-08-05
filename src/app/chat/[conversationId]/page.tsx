'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, ImagePlus } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { chatApi, ChatMessage, validateImageFile, UPLOAD_ACCEPT } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { featureFlags } from '@/lib/features';
import { getSafeReturnTo } from '@/lib/auth-redirect';

function sortMessagesByCreatedAt(items: ChatMessage[]) {
  return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));

  incoming.forEach((message) => {
    if (message.clientMsgId) {
      byId.delete(message.clientMsgId);
    }
    byId.set(message.id, message);
  });

  return sortMessagesByCreatedAt(Array.from(byId.values()));
}

function ChatConversationContent() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const bookingId = searchParams.get('bookingId') || undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [sendError, setSendError] = useState('');
  const [chatAvailable, setChatAvailable] = useState(false);
  const [peerId, setPeerId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const backHref = getSafeReturnTo(`?${searchParams.toString()}`) || '/chat';

  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);
    loadMessages();
  }, [conversationId, bookingId]);
  useEffect(() => {
    if (!conversationId) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages(false);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [conversationId, bookingId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadMessages(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const res = await chatApi.getMessages(conversationId, undefined, 30, bookingId);
      setMessages((current) => mergeChatMessages(current, (res.data.messages || []).reverse()));
      setPeerId(res.data.peerId || '');
      if (res.data.chatAvailable) {
        setChatAvailable(true);
      } else if (bookingId) {
        try {
          const openRes = await chatApi.openBookingConversation(bookingId);
          setPeerId(openRes.data.peerId || res.data.peerId || '');
          setChatAvailable(Boolean(openRes.data.chatAvailable));
          if (openRes.data.conversationId && openRes.data.conversationId !== conversationId) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set('bookingId', bookingId);
            router.replace(`/chat/${openRes.data.conversationId}?${nextParams.toString()}`);
          }
        } catch {
          setChatAvailable(false);
        }
      } else {
        setChatAvailable(false);
      }
      // Mark as read
      const lastMsg = res.data.messages?.[0];
      if (lastMsg && lastMsg.senderId !== user?.id) {
        chatApi.markRead(conversationId, lastMsg.id).catch(() => {});
      }
    } catch { /* empty */ }
    finally {
      if (showLoader) setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending || !chatAvailable) return;

    const clientMsgId = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const msgText = text.trim();
    setText('');
    setSendError('');
    setSending(true);

    // Optimistic update
    const optimistic: ChatMessage = {
      id: clientMsgId,
      conversationId,
      senderId: user?.id || '',
      receiverId: '',
      type: 'TEXT',
      text: msgText,
      clientMsgId,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      // We need the receiverId — we can get it from existing messages
      const peer = messages.find(m => m.senderId !== user?.id);
      const receiverId = peerId || peer?.senderId || '';
      if (receiverId) {
        const res = await chatApi.sendMessage(receiverId, msgText, clientMsgId, bookingId);
        setMessages(prev => mergeChatMessages(prev.filter(m => m.id !== clientMsgId), [res.data]));
        loadMessages(false);
      }
    } catch (err: unknown) {
      setMessages(prev => prev.filter(m => m.id !== clientMsgId));
      setSendError(err instanceof Error ? err.message : 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleSendImage(file: File) {
    const invalid = validateImageFile(file);
    if (invalid) {
      setImageError(invalid);
      return;
    }
    if (!chatAvailable) {
      setImageError('Chat is read-only after the ride is closed.');
      return;
    }
    setImageError('');
    setUploadingImage(true);

    const clientMsgId = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    const optimistic: ChatMessage = {
      id: clientMsgId,
      conversationId,
      senderId: user?.id || '',
      receiverId: '',
      type: 'IMAGE',
      text: null,
      clientMsgId,
      createdAt: new Date().toISOString(),
      payloadJson: { imageUrl: previewUrl },
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const peer = messages.find(m => m.senderId !== user?.id);
      const receiverId = peerId || peer?.senderId || '';
      if (receiverId) {
        const res = await chatApi.uploadAndSendImage(receiverId, file, clientMsgId, bookingId);
        setMessages(prev => mergeChatMessages(prev.filter(m => m.id !== clientMsgId), [res.data]));
        loadMessages(false);
      }
    } catch (err: unknown) {
      setMessages(prev => prev.filter(m => m.id !== clientMsgId));
      setImageError(err instanceof Error ? err.message : 'Failed to send image');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingImage(false);
    }
  }

  return (
    <div className="flex h-screen bg-deliivo-cream lg:px-6 lg:py-5">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-sm lg:rounded-2xl lg:border lg:border-orange-100">
      {/* Header */}
      <header className="bg-white border-b border-orange-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-deliivo-orange">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-base font-semibold text-gray-900">Chat</h1>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-deliivo-cream/40 px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-deliivo-orange" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-sm text-deliivo-gray">No messages yet. Say hello!</div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-deliivo-orange text-white rounded-br-md' : 'bg-white text-deliivo-dark rounded-bl-md shadow-sm'}`}>
                  {msg.type === 'IMAGE' && msg.payloadJson?.imageUrl && (
                    <img
                      src={msg.payloadJson.imageUrl}
                      alt=""
                      className="mb-1 max-h-64 w-full rounded-lg object-cover"
                    />
                  )}
                  {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-deliivo-gray'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 bg-white">
        {imageError && <p className="px-4 pt-2 text-xs text-red-600">{imageError}</p>}
        {sendError && <p className="px-4 pt-2 text-xs text-red-600">{sendError}</p>}
        {!chatAvailable && (
          <p className="px-4 pt-3 text-xs font-medium text-deliivo-gray">
            This chat is read-only. Messages are available only while the ride is active.
          </p>
        )}
        <form onSubmit={handleSend} className="px-4 py-3 flex gap-2">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-deliivo-gray hover:bg-gray-100 disabled:opacity-40 transition-colors">
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <input
              type="file"
              accept={UPLOAD_ACCEPT}
              className="hidden"
              disabled={uploadingImage || !chatAvailable}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSendImage(f);
                e.target.value = '';
              }}
            />
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!chatAvailable}
            placeholder={chatAvailable ? 'Type a message...' : 'Ride chat is closed'}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:border-deliivo-orange focus:outline-none focus:ring-2 focus:ring-deliivo-orange/20"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending || !chatAvailable}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-deliivo-orange text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}

export default function ChatConversationPage() {
  return (
    <ProtectedRoute>
      {featureFlags.webChat ? (
        <ChatConversationContent />
      ) : (
        <div className="min-h-screen bg-deliivo-cream">
          <header className="bg-white border-b border-orange-100 px-4 py-3 flex items-center gap-3">
            <Link href="/rides" className="flex items-center gap-1 text-sm text-gray-600 hover:text-deliivo-orange">
              <ArrowLeft className="w-4 h-4" /> Rides
            </Link>
            <h1 className="text-base font-semibold text-gray-900">Messages unavailable</h1>
          </header>
          <main className="mx-auto max-w-2xl px-4 py-10">
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-base font-semibold text-deliivo-dark">Web messages are disabled</p>
              <p className="mt-2 text-sm text-deliivo-gray">
                Use ride details and notifications for booking and ride-day updates.
              </p>
              <Link href="/rides" className="btn-primary mt-5 inline-flex px-6 py-2.5 text-sm">
                Back to rides
              </Link>
            </div>
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}
