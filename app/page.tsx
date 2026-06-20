"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "firebase/auth";
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2">
      <div className="flex items-center justify-between bg-gray-700 px-3 py-1 rounded-t-lg">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-300 hover:text-white transition"
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ fontSize: "12px", borderRadius: "0 0 8px 8px", overflowX: "auto", maxWidth: "100%", margin: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function ChatInput({ onSend, prefill }: { onSend: (text: string, image: File | null, imagePreview: string | null) => void; prefill?: string }) {
  const [localInput, setLocalInput] = useState("");
  useEffect(() => {
    if (prefill) {
      setLocalInput(prefill);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
        textareaRef.current.focus();
      }
    }
  }, [prefill]);
  const [localImage, setLocalImage] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageUpload = (file: File | null) => {
    if (!file) return;
    setLocalImage(file);
    setLocalPreview(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    if (!localInput.trim()) return;
    onSend(localInput, localImage, localPreview);
    setLocalInput("");
    setLocalImage(null);
    setLocalPreview(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#0A0A0A] p-3 md:p-4">
      <div className="mx-auto w-full max-w-3xl">
        {localPreview && (
          <div className="mb-2 flex items-center gap-2">
            <img src={localPreview} alt="preview" className="h-20 rounded-lg border border-gray-600" />
            <button
              onClick={() => { setLocalImage(null); setLocalPreview(null); }}
              className="text-gray-400 hover:text-red-400 text-xs"
            >
              ✕ Remove
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-[#171717] border border-white/10 rounded-3xl px-2 py-2 focus-within:border-white/30 transition">
          <label className="shrink-0 cursor-pointer text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
            <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(e.target.files?.[0] || null)} />
          </label>

          <textarea
            ref={textareaRef}
            value={localInput}
            onChange={(e) => {
              setLocalInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Message Nexora..."
            rows={1}
            style={{ resize: "none" }}
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none border-none py-2 text-sm leading-relaxed max-h-[150px] overflow-y-auto scrollbar-thumb-gray-600 scrollbar-track-transparent"
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!localInput.trim()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </motion.button>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-1.5">Built with ❤️ by Ayush Kumar</p>
      </div>
    </div>
  );
}

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt?: number;
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [prefillText, setPrefillText] = useState("");

  const [prefillKey, setPrefillKey] = useState(0);

  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const stopStreamingRef = useRef(false);

  const [editingChatId, setEditingChatId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [imagePreview] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);


  const createNewChat = () => {
    setChats((prev) => {
      const cleaned = prev.filter(
        (chat) => chat.title !== "New Chat" || chat.messages.length > 1
      );

      const newChat: Chat = {
        id: Date.now().toString(),
        title: "New Chat",
        createdAt: Date.now(),
        messages: [
          {
            role: "assistant",
            content: "Hi buddy!👋 I'm Nexora. How can I help you today?",
          },
        ],
      };

      setActiveChatId(newChat.id);
      return [newChat, ...cleaned];
    });
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chats, isTyping]);

  useEffect(() => {
    if (!user) return;

    const loadChats = async () => {
      try {
        const q = query(
          collection(db, "users", user.uid, "chats"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          createNewChat();
          return;
        }

        const loaded = snapshot.docs.map((doc) => doc.data() as Chat);
        setChats(loaded);
        setActiveChatId(loaded[0]?.id || null);
      } catch (err) {
        console.error("Failed to load chats:", err);
        createNewChat();
      }
    };

    loadChats();
  }, [user]);



  useEffect(() => {
    if (!user || chats.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        for (const chat of chats) {
          await setDoc(doc(db, "users", user.uid, "chats", chat.id), {
            ...chat,
            createdAt: chat.createdAt || Date.now(),
          });
        }
      } catch (err) {
        console.error("Failed to save chats:", err);
      }
    }, 3000);

    return () => clearTimeout(timer); // cleanup
  }, [chats, user]);



  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const playSound = (soundType: "send" | "receive") => {
    const audio = new Audio(
      soundType === "send" ? "/send.mp3" : "/receive.mp3"
    );
    audio.volume = 0.5;
    audio.play().catch(() => { });
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
    } catch (error) {
      console.error(error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);

      setChats([]);
      setActiveChatId(null);

      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const startEditing = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const [copySuccess, setCopySuccess] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(index);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      console.error("Failed to copy.");
    }
  };

  const streamResponse = useCallback(async (fullText: string, chatId: string) => {
    let currentText = "";
    stopStreamingRef.current = false;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, { role: "assistant", content: "" }] }
          : chat
      )
    );

    for (let i = 0; i < fullText.length; i++) {
      if (stopStreamingRef.current) break;

      currentText += fullText[i];

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          const updatedMessages = [...chat.messages];
          updatedMessages[updatedMessages.length - 1] = {
            role: "assistant",
            content: currentText,
          };
          return { ...chat, messages: updatedMessages };
        })
      );

      if (i % 3 === 0) {
        await new Promise((res) => setTimeout(res, 0));
      }
    }

    setIsTyping(false);
  }, []);

  const updateChatTitle = (id: string, title: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id ? { ...chat, title } : chat
      )
    );
  };

  const handleRename = (id: string) => {
    if (!editTitle.trim()) return;

    updateChatTitle(id, editTitle);
    setEditingChatId(null);
    setEditTitle("");
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.readAsDataURL(file);

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.onerror = (error) => reject(error);
    });
  };

  const deleteChat = async (id: string) => {
    // Pehle Firestore se delete karo
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "chats", id));
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }

    setChats((prev) => {
      const updated = prev.filter((chat) => chat.id !== id);

      if (updated.length === 0) {
        const newChat: Chat = {
          id: Date.now().toString(),
          title: "New Chat",
          createdAt: Date.now(),
          messages: [
            {
              role: "assistant",
              content: "Hi buddy!👋 I'm Nexora. How can I help you today?",
            },
          ],
        };
        setActiveChatId(newChat.id);
        return [newChat];
      }

      if (activeChatId === id) {
        setActiveChatId(updated[0].id);
      }

      return updated;
    });
  };


  const handleSend = async (userMessage: string, sentImage: File | null) => {
    if (!userMessage.trim()) return;
    playSound("send"); setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
            ...chat,
            title:
              chat.title === "New Chat"
                ? userMessage.slice(0, 30)
                : chat.title,
            messages: [
              ...chat.messages,
              {
                role: "user",
                content: userMessage,
              },
            ],
          }
          : chat
      )
    );

    setIsTyping(true);

    try {
      let base64Image = null;

      if (sentImage) {
        base64Image = await convertToBase64(sentImage);
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history: activeChat?.messages || [],
          image: base64Image,
        }),
      });

      const data = await response.json();
      await streamResponse(data.reply, activeChatId!);
      playSound("receive");
    }
    catch {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
              ...chat,
              messages: [
                ...chat.messages,
                {
                  role: "assistant",
                  content:
                    "Sorry buddy, something went wrong.",
                },
              ],
            }
            : chat
        )
      );
    }

    setIsTyping(false);
  };

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) || chats[0];

  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="relative flex items-center justify-center h-screen overflow-hidden">

        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black animate-[pulse-4s-ease-in-out_infinite]"></div>

        {/* Floating Glow Blobs */}
        <div className="absolute w-72 h-72 bg-purple-500/30 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
        <div className="absolute w-72 h-72 bg-blue-500/20 rounded-full blur-3xl bottom-10 right-10 animate-pulse"></div>

        {/* Glass Card */}
        <div className="relative z-10 w-[380px] p-8 rounded-2xl 
        bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl">

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Nexora😎
            </h1>
            <p className="text-sm text-gray-300 mt-2">
              Your intelligent chat companion
            </p>
            <p className="text-center text-xs text-gray-400 mt-6">
              Built with ❤️ by Ayush Kumar
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-white/20"></div>
            <span className="text-xs text-gray-400 tracking-widest">
              WELCOME
            </span>
            <div className="h-px flex-1 bg-white/20"></div>
          </div>

          {/* Login Button */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 
          bg-white text-black py-3 rounded-xl font-semibold
          hover:scale-[1.03] transition duration-200 shadow-lg"
          >
            <span className="text-lg"></span>
            Continue with Google
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Secure login powered by Google Authentication
          </p>

        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen text-white bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0f0f0f]">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-[#171717] border-r border-gray-700 z-50 transform transition-transform duration-300 flex flex-col
  md:static md:translate-x-0
  ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Top: New Chat + Search */}
        <div className="p-4 shrink-0">
          <button
            onClick={createNewChat}
            className="w-full rounded-lg bg-white text-black px-4 py-2 font-medium hover:opacity-90 transition"
          >
            + New Chat
          </button>
          <div className="pt-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-800 text-white outline-none border border-gray-700 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Middle: Scrollable chat list */}
        <div className="flex-1 overflow-y-auto px-2">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                setActiveChatId(chat.id);
                setIsSidebarOpen(false);
              }}

              onTouchStart={() => {
                pressTimer.current = setTimeout(() => {
                  setSelectedChat(chat);
                }, 500);
              }}

              onTouchEnd={() => {
                if (pressTimer.current) {
                  clearTimeout(pressTimer.current);
                }
              }}

              className={`group flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition ${chat.id === activeChatId ? "bg-gray-800" : "hover:bg-gray-800/60"
                }`}
            >
              {editingChatId === chat.id ? (
                <input
                  value={editTitle}
                  autoFocus
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleRename(chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(chat.id);
                  }}
                  className="bg-gray-700 text-white text-sm px-2 py-1 rounded w-full mr-2"
                />
              ) : (
                <span
                  onDoubleClick={() => startEditing(chat)}
                  className="truncate text-sm flex-1 cursor-pointer text-gray-200"
                >
                  {chat.title}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition"
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        {/* Bottom: User info - always visible */}
        <div className="shrink-0 border-t border-gray-700 p-4">
          <p className="text-xs text-gray-500 mb-3">Nexora</p>
          <div className="flex items-center gap-3">
            {user?.photoURL && (
              <img
                src={user?.photoURL || "/default-avatar.png"}
                alt="Profile"
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-sm text-gray-300 truncate flex-1">
              {user?.displayName}
            </span>
            <button
              onClick={logout}
              className="text-xs text-red-400 hover:text-red-300 shrink-0"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-[#0A0A0A] min-w-0">

        {/* Fixed Header */}
        <div className="shrink-0 border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-xl bg-[#0A0A0A]">
          <button
            className="md:hidden text-white text-2xl"
            onClick={() => setIsSidebarOpen(true)}
          >
            ☰
          </button>
          <h1 className="text-xl font-semibold">Nexora😎</h1>
        </div>

        {/* Scrollable Messages ONLY */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            <AnimatePresence>
              {activeChat?.messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${message.role === "user"
                      ? "bg-white text-black ml-auto"
                      : "bg-[#1A1A1A] text-white border border-white/10"
                      }`}
                  >
                    <div className="mb-1 text-[11px] text-gray-400">
                      {message.role === "user" ? "You" : "Nexora"}
                    </div>

                    {message.role === "assistant" ? (
                      <div>
                        <ReactMarkdown
                          components={{
                            code({ className, children }) {
                              const match = /language-(\w+)/.exec(className || "");
                              return match ? (
                                <CodeBlock language={match[1]} code={String(children).replace(/\n$/, "")} />
                              ) : (
                                <code className="bg-gray-800 rounded px-1">
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {index > 0 && (
                          <button
                            onClick={() => copyToClipboard(message.content, index)}
                            className="mt-2 rounded-lg bg-gray-700/60 border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600 transition"
                          >
                            {copySuccess === index ? "✓ Copied!" : "Copy"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Welcome screen for new chat */}
            {activeChat?.messages.length === 1 && (
              <div className="flex flex-col items-center justify-center mt-20 text-center px-4">
                <div className="text-5xl mb-4">😎</div>
                <h2 className="text-xl font-semibold text-white mb-2">How can I help you?</h2>
                <p className="text-gray-500 text-sm">Ask me anything — code, questions, ideas.</p>
                <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-sm">
                  {["Write a poem 🎵", "Explain AI 🤖", "Debug my code 💻", "Tell a joke 😄"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setPrefillText(suggestion);
                        setPrefillKey((k) => k + 1);
                      }}
                      className="text-xs bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-xl px-3 py-2 text-gray-300 transition text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isTyping && (
              <div className="flex items-center gap-3 text-gray-400">
                <div className="animate-bounce">●</div>
                <div className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</div>
                <div className="animate-bounce" style={{ animationDelay: "0.4s" }}>●</div>
                <span>Nexora is thinking...</span>
                <button
                  onClick={() => {
                    stopStreamingRef.current = true;
                    setTimeout(() => setIsTyping(false), 50);
                  }}
                  className="ml-2 text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded-lg transition"
                >
                  ⏹ Stop
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <ChatInput key={prefillKey} onSend={(text, img) => handleSend(text, img)} prefill={prefillText} />

      </div>
      {selectedChat && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 md:hidden">
          <div className="w-full rounded-t-2xl bg-[#2F2F2F] p-4">
            <button
              onClick={() => {
                startEditing(selectedChat);
                setSelectedChat(null);
              }}
              className="w-full rounded-lg px-4 py-3 text-left hover:bg-gray-700"
            >
              ✏️ Rename
            </button>

            <button
              onClick={() => {
                deleteChat(selectedChat.id);
                setSelectedChat(null);
              }}
              className="mt-2 w-full rounded-lg px-4 py-3 text-left text-red-400 hover:bg-gray-700"
            >
              🗑️ Delete
            </button>

            <button
              onClick={() => setSelectedChat(null)}
              className="mt-2 w-full rounded-lg px-4 py-3 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

}