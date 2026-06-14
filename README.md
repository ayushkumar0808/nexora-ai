# 🤖 Nexora AI

A modern full-stack AI chatbot powered by **Google Gemini**, built with **Next.js, Firebase, and Tailwind CSS**.  
It supports real-time AI chat, authentication, image input, chat history, and a premium SaaS UI experience.

---

## 🚀 Live Demo

👉 https://nexora-ai-kappa-topaz.vercel.app

---

## ✨ Features

- 🔐 Google Authentication (Firebase)
- 💬 AI Chat using Google Gemini
- ⚡ Real-time typing effect (streaming UI simulation)
- 🖼️ Image + text input support
- 🗂️ Chat history per user (Firestore)
- ✏️ Rename chats
- 🗑️ Delete chats
- 🔎 Search chat history
- 📱 Fully responsive mobile UI
- 🎨 Modern SaaS-style dark UI

---

## 🧠 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes
- **AI Model:** Google Gemini (`@google/genai`)
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Hosting:** Vercel

---

## 📁 Project Structure
app/
├── api/
│ └── chat/route.ts # Gemini API backend
├── page.tsx # Main UI (Chat + Login)
lib/
└── firebase.ts # Firebase config


---

## ⚙️ Installation & Setup

### 1️. Clone Repository

-git clone https://github.com/ayushkumar0808/nexora-ai.git
 cd nexora-ai

### 2. Install Dependencies
```
npm install

```
### 3. Setup Environment Variables
Create a .env.local file in root:
```
GEMINI_API_KEY=your_gemini_api_key

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```
### 4. Run Development Server
```
npm run dev
```
Open:
👉 http://localhost:3000


### 5. Deployment (Vercel)

Push code to GitHub
Go to 👉 https://vercel.com
Import your repository
Add environment variables
Click Deploy

### 💡 Features Explained
## 💬 AI Chat
Users can chat with Gemini AI in real time.

## 🔐 Authentication
Secure login using Firebase Google Authentication.

## 🗂️ Chat System
Each user gets:

Multiple chats
Rename chats
Delete chats
Search chats

## 🖼️ Image Support

Upload images and ask AI questions about them.

## 🧠 Future Improvements

🔥 Real Gemini streaming API
🧠 Memory-based AI (context awareness)
🎙️ Voice input/output
💰 Subscription system (SaaS monetization)
🌐 Custom domain support


## 👨‍💻 Author

Built with ❤️ by Nexora AI Developer

## 📜 License

This project is open-source and free to use under the MIT License.



