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

  const [input, setInput] = useState("");

  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const stopStreamingRef = useRef(false);

  const [editingChatId, setEditingChatId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [image, setImage] = useState<File | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


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

    const saveChats = async () => {
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
    };

    saveChats();
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

  const handleImageUpload = (file: File | null) => {
    if (!file) return;

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
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

  const deleteChat = (id: string) => {
    setChats((prev) => {
      if (user) {
        deleteDoc(doc(db, "users", user.uid, "chats", id)).catch(console.error);
      }
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


  const handleSend = async () => {
    if (!input.trim()) return;
    playSound("send");
    const userMessage = input;
    setChats((prev) =>
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

    setInput("");
    setIsTyping(true);
    setImage(null);
    setImagePreview(null);

    try {
      let base64Image = null;

      if (image) {
        base64Image = await convertToBase64(image);
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
            <span className="text-lg">🔵</span>
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
                                <SyntaxHighlighter
                                  language={match[1]}
                                  style={oneDark}
                                  customStyle={{ fontSize: "12px", borderRadius: "8px", overflowX: "auto", maxWidth: "100%" }}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
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
                      onClick={() => setInput(suggestion)}
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

        {/* Fixed Input Bar */}
        <div className="shrink-0 border-t border-white/10 bg-[#0A0A0A] p-4">
          <div className="mx-auto w-full max-w-3xl">

            {imagePreview && (
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-20 rounded-lg border border-gray-600"
                />
                <button
                  onClick={() => { setImage(null); setImagePreview(null); }}
                  className="text-gray-400 hover:text-red-400 text-xs"
                >
                  ✕ Remove
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <label className="cursor-pointer text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-xl">
                🔗
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
                />
              </label>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Nexora..."
                className="flex-1 rounded-xl bg-[#111111] border border-white/10 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 text-white font-medium"
              >
                Send
              </motion.button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}