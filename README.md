This complete README.md file provides a concise, human‑friendly explanation of the platform’s technology, workflow, and agent roles, along with instructions on how to get started and deploy the system.

# AutoBiz-AI (JS-AutoAgent)

AutoBiz-AI is an enterprise‑grade platform that automates document processing and business workflows—all directly within your web browser. Think of it as a digital team of smart assistants that read, analyze, and act on your documents using advanced AI techniques—without the need for heavy backend infrastructure.

---

## Table of Contents

- [Overview](#overview)
- [Key Technologies](#key-technologies)
- [Workflow Overview](#workflow-overview)
- [Role of AI Agents](#role-of-ai-agents)
- [Bringing It All Together](#bringing-it-all-together)
- [How to Use AutoBiz-AI](#how-to-use-autobiz-ai)
- [Deployment & Support](#deployment--support)
- [Conclusion](#conclusion)

---

## Overview

AutoBiz-AI (powered by JS-AutoAgent) enables real‑time, browser‑based document processing and workflow automation. It leverages modern web technologies like WebAssembly, Reinforcement Learning, and Large Language Models (via the Gemini 1.5 API) to process documents and execute business tasks efficiently. With Google Drive integration, you can manage your files seamlessly while our self‑improving AI agents handle everything—from data extraction and summarization to report generation and automation of routine tasks.

---

## Key Technologies

- **WebAssembly (WASM)**
  - **What it does:** Runs near‑native performance code in the browser.
  - **Why it matters:** Accelerates heavy document processing (e.g., parsing PDFs, extracting data) without relying on traditional servers.

- **Reinforcement Learning (RL)**
  - **What it does:** Enables AI agents to learn from feedback by rewarding successful actions.
  - **Why it matters:** Continuously improves agent accuracy and performance over time.

- **Large Language Models (LLMs) via Gemini 1.5 API**
  - **What it does:** Understands and generates natural language to summarize documents, extract key information, and generate reports.
  - **Why it matters:** Provides advanced language understanding for complex document analysis and intelligent responses.

- **Google Drive Integration**
  - **What it does:** Allows users to upload, manage, and process documents directly from Google Drive.
  - **Why it matters:** Offers a seamless and familiar file management experience while centralizing document processing.

---

## Workflow Overview

AutoBiz-AI mimics the workflow of a human team to process and automate tasks:

1. **User Request:**  
   - You initiate a task (e.g., “Process my monthly sales report”) via an intuitive web interface.

2. **Task Management:**  
   - **NLP Agent:** Understands your request.
   - **Task Decomposer:** Breaks it into smaller subtasks (e.g., “Extract data,” “Summarize findings”).
   - **Task Allocator:** Assigns these subtasks to the right specialized AI agents.

3. **Processing by Specialized AI Agents:**  
   - Each agent (e.g., Summarization Agent, Data Extraction Agent) performs its specific function.  
   - Agents can work independently or collaborate under the guidance of an **Agent Coordinator**.

4. **Continuous Learning:**  
   - Reinforcement Learning monitors outcomes and helps agents adjust their strategies for better performance in future tasks.

5. **Results & Feedback:**  
   - Processed data, summaries, and reports are delivered in real‑time.  
   - A dashboard displays task status, history, and performance metrics.

---

## Role of AI Agents

### Task Management Agents
- **NLP Agent:** Analyzes natural language to capture user intent.
- **Task Decomposer & Allocator:** Splits complex tasks into manageable parts and assigns them to the appropriate agents.

### Specialized Agents
Each agent acts like a member of your digital team:
- **Summarization Agent:** Reads documents and generates concise summaries.
- **Data Extraction Agent:** Identifies and retrieves key information such as dates, numbers, and critical phrases.
- **Report Generator Agent:** Compiles data into structured, easily understood reports.
- **Data Analysis Agent:** Performs statistical analysis and creates visualizations (charts/graphs) for better insights.
- **Automation Workflow Agent:** Orchestrates multi‑step processes by coordinating the actions of various agents.

### Multi-Agent Coordination
- **Agent Coordinator:** Functions like a project manager, scheduling tasks and resolving conflicts to ensure smooth teamwork.
- **Message Queue & LLM Supervisor:** Manage communication between agents and oversee complex decision‑making.

---

## Bringing It All Together

Imagine you need to process a batch of monthly financial reports stored in Google Drive:

- **Upload & Processing:**  
  Drag and drop your files into the platform. The Document Processor (powered by WASM) validates and parses each file quickly.
  
- **Data Extraction & Analysis:**  
  The system uses OCR (if needed) and advanced NLP (via Hugging Face and Gemini 1.5) to extract key figures, dates, and insights.
  
- **Summarization & Reporting:**  
  A Summarization Agent condenses detailed data into a concise report, while a Report Generator Agent creates a visual dashboard.
  
- **Automation & Continuous Improvement:**  
  Throughout the process, agents communicate through the coordination layer and continuously refine their actions using reinforcement learning.
  
- **Results Display:**  
  Real‑time updates appear on a sleek dashboard with a left‑side sliding menu, enabling seamless navigation between the document database, chatbot, task automation, and history views.

---

## How to Use AutoBiz-AI

### Getting Started

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/anmolsureka30/AutoBiz-AI.git
   cd AutoBiz-AI

2. Install dependencies
   ```bash
    npm  install


3. Set Up Environment Variables:
   ```bash

   cp .env.example .env
   # Edit .env with your GEMINI_API_KEY, GOOGLE_DRIVE_CLIENT_ID, and GOOGLE_DRIVE_CLIENT_SECRET


4 . Start the Development Server:
    
    npm run dev






Due to some unavoidable last minute issue , this may not compile . please consider . also see the images when it was working
<img width="1470" alt="Screenshot 2025-02-18 at 11 52 33 PM" src="https://github.com/user-attachments/assets/70295c83-0e3b-40f8-8f2f-3f668c2717e1" />

<img width="1470" alt="Screenshot 2025-02-18 at 11 52 26 PM" src="https://github.com/user-attachments/assets/e39f62b4-f9ff-4d9d-af75-e131c815eb9a" />
<img width="1470" alt="Screenshot 2025-02-18 at 11 52 16 PM" src="https://github.com/user-attachments/assets/5c679e35-0776-4a0c-9dfe-f857864f69f8" />
