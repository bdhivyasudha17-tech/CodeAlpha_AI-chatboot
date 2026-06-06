
# 🩺 MedAI — Pastel-Themed AI Healthcare Chatbot

MedAI is a premium, modern, and responsive AI-powered healthcare assistant chatbot built entirely in vanilla HTML, CSS, and JavaScript. It runs locally in the browser using a zero-dependency retrieval-based Natural Language Processing (NLP) engine.

Designed with a calming **pastel color palette** (soft mint greens, lavenders, warm peaches, and soft blues), MedAI provides instant responses to common healthcare queries while maintaining safety with built-in emergency keyword detection.

---

## ✨ Features

- **🎨 Premium Pastel Theme:** Gentle HSL-tailored colors, smooth fade-in animations, responsive 3-column layout (Sidebar navigation | Chat area | Health stats panel).
- **🧠 Local AI NLP Engine:** Retrieval-based engine utilizing keyword/phrase token matching with weighted scoring to match user queries to trained medical intents.
- **💬 Quick-Reply Chips:** Dynamically suggests interactive response options after each message to guide the conversation.
- **🚨 Emergency Detection:** Instantly triggers an alert banner at the top of the screen with emergency hotlines (911, 988, Poison Control) if critical symptoms (like chest pain, breathing issues, or self-harm thoughts) are detected.
- **📊 Health & Wellness Tracker:** Right-hand side panel showing simulated fitness goal progress (Water, Steps, Sleep) and rotating daily wellness tips.
- **🧹 Session Control:** Keep track of message count in the sidebar with a quick one-click "Clear Conversation" button.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, Vanilla CSS3 (Custom properties/variables, Flexbox, Grid), ES6+ JavaScript.
- **Backend (Dev Server):** Node.js HTTP module (Zero dependencies).
- **Fonts & Icons:** Google Fonts (Poppins & Inter), Boxicons.

---

## 📁 Project Structure

```text
📁 design-ai-commercial-chatbot/
├── index.html          # Main chatbot UI and layout
├── styles.css          # Pastel color variables, layout, styling, and animations
├── app.js              # Chat interface orchestration & UI logic
├── dev-server.js       # Node.js local web server
├── package.json        # Project metadata & npm dev script
└── modules/
    └── chatbot.js      # NLP Engine & 24 Predefined Medical Intents
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation & Run Steps
1. Clone or download this repository to your local machine.
2. Open your terminal in the project directory.
3. Start the local development server:
   ```bash
   npm run dev
   ```
   *Alternatively, run: `node dev-server.js`*
4.## 🚀 Live Demo & Deployment
* **Live Web App**:  https://github.com/bdhivyasudha17-tech/CodeAlpha_AI-chatboot
* **Local Run**: `http://localhost:3000`
   ```

---

## 💬 Try These Predefined Intents

Here are some sample queries you can type to test the chatbot:

* **General Symptoms:** `I feel sick`, `Symptom checker`
* **Fever & Cough:** `I have a fever`, `I have a cough and cold`
* **Appointments & Doctors:** `How do I book an appointment?`, `Find a cardiologist`
* **Medications:** `What medicine can I take for a headache?`, `I need a prescription refill`
* **Mental Health:** `I feel anxious`, `I'm having a panic attack`
* **Emergency (Triggers Warning Banner):** `I have chest pain`, `I can't breathe`
* **Insurance & Admin:** `Do you accept my insurance?`, `What is a copay?`

---

## ⚠️ Medical Disclaimer

**MedAI is for informational and educational purposes only.** It does not provide professional medical advice, diagnosis, or treatment. Always consult with a qualified physician or healthcare provider for medical concerns. **In case of a medical emergency, call 911 immediately.**
```
