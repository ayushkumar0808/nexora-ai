"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut } from "firebase/auth";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [input, setInput] = useState("");

  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const [editingChatId, setEditingChatId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [image, setImage] = useState<File | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    const savedChats = localStorage.getItem("nexora_chats");

    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      setChats(parsed);
      setActiveChatId(parsed[0]?.id || "");
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("nexora_chats", JSON.stringify(chats));
    }
  }, [chats]);

  useEffect(() => {
    if (chats.length === 0) {
      createNewChat();
    }
  }, []);

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
      setUser(null); // important UI reset
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const startEditing = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };


  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied!");
    } catch {
      alert("Failed to copy.");
    }
  };

  const streamResponse = async (fullText: string) => {
    let currentText = "";

    // add empty assistant message first
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
            ...chat,
            messages: [
              ...chat.messages,
              { role: "assistant", content: "" },
            ],
          }
          : chat
      )
    );

    for (let i = 0; i < fullText.length; i++) {
      currentText += fullText[i];

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatId) return chat;

          const updatedMessages = [...chat.messages];

          updatedMessages[updatedMessages.length - 1] = {
            role: "assistant",
            content: currentText,
          };

          return {
            ...chat,
            messages: updatedMessages,
          };
        })
      );

      // speed control (typing feel)
      await new Promise((res) => setTimeout(res, 15));
    }
  };

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
      const updated = prev.filter((chat) => chat.id !== id);

      if (updated.length === 0) {
        const newChat: Chat = {
          id: Date.now().toString(),
          title: "New Chat",
          messages: [
            {
              role: "assistant",
              content: "Hi buddy! 👋 I'm Nexora.",
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
          image: base64Image,
        }),
      });

      const data = await response.json();

      await streamResponse(data.reply);
    } catch {
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

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [
        {
          role: "assistant",
          content: "Hi buddy!👋 I'm Nexora. How can I help you today?",
        },
      ],
    };

    setChats((prev) => [newChat, ...prev]);

    setActiveChatId(newChat.id);
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
              Created by AYUSH
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
    <div className="flex h-screen bg-[#212121] text-white overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed md:static top-0 left-0 h-full w-64 bg-[#171717] border-r border-gray-700 z-50 transform transition-transform duration-300
  ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full rounded-lg bg-white text-black px-4 py-2 font-medium hover:opacity-90 transition"
          >
            + New Chat
          </button>
          <div className="p-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-800 text-white outline-none border border-gray-700 focus:border-gray-500"
            />
          </div>
        </div>
        <div className="flex-1 p-2 overflow-y-auto">
          {filteredChats.map((chat) => (

            <div
              key={chat.id}
              onClick={() => {
                setActiveChatId(chat.id);
                setIsSidebarOpen(false);
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${chat.id === activeChatId
                ? "bg-gray-800"
                : "hover:bg-gray-800/60"
                }`}
            >
              {/* Chat title */}
              {editingChatId === chat.id ? (
                <input
                  value={editTitle}
                  autoFocus
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleRename(chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRename(chat.id);
                    }
                  }}
                  className="bg-gray-700 text-white text-sm px-2 py-1 rounded w-full mr-2"
                />
              ) : (
                <span
                  onDoubleClick={() => startEditing(chat)}
                  className="truncate text-sm flex-1 cursor-pointer"
                >
                  {chat.title}
                </span>
              )}

              {/* Delete button */}
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

        <div className="border-t border-gray-700 p-4 text-sm text-gray-500">
          Nexora
        </div>
        <div className="flex items-center gap-3">

          {user?.photoURL && (
            <img
              src={user.photoURL}
              className="w-8 h-8 rounded-full"
            />
          )}

          <span className="text-sm text-gray-300">
            {user?.displayName}
          </span>

          <button
            onClick={logout}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Logout
          </button>

        </div>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-[#0A0A0A]">
        <div className="border-b border-gray-700 px-6 py-4">
          <h1 className="text-xl font-semibold">
            Nexora😎
          </h1>
        </div>
        <button
          className="md:hidden text-white text-2xl"
          onClick={() => setIsSidebarOpen(true)}
        >
          ☰
        </button>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {activeChat?.messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user"
                  ? "justify-end"
                  : "justify-start"
                  }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${message.role === "user"
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

                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="mt-2 rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="text-gray-400">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-bounce">●</div>
                  <div
                    className="animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  >
                    ●
                  </div>
                  <div
                    className="animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  >
                    ●
                  </div>

                  <span>Nexora is thinking...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-white/10 bg-[#0A0A0A] p-4">
          <div className="mx-auto flex max-w-3xl gap-3">
            <label className="cursor-pointer text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-xl">
              🔗

              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) =>
                  handleImageUpload(e.target.files?.[0] || null)
                }
              />
            </label>
            {imagePreview && (
              <div className="mb-2">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-24 rounded-lg border border-gray-600"
                />
              </div>
            )}

            <input
              value={input}

              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
              placeholder="Message Nexora..."
              className="flex-1 rounded-xl bg-[#111111] border border-white/10 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
            />

            <button
              onClick={handleSend}
              className="rounded-xl bg-white text-black px-6 py-3 font-medium hover:bg-gray-200 active:scale-[0.98] transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}