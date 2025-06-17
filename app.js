// Seleciona elementos do DOM que serão usados na aplicação
const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");

const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
themeToggle = document.querySelector("#theme-toggle-btn"); // OBS: faltou "const"

// Chave da API do Gemini para autenticação
const API_KEY = "AIzaSyCr4MI4sujK6JxcfBjEUJbzp0OU8rxoUzE";

// URL completa da API do Gemini com modelo Gemini 2.0 Flash
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Variáveis de controle
let typingInterval, controller;

// Armazena o histórico do chat (usuário e bot)
const chatHistory = [];

// Objeto com os dados da mensagem atual do usuário (texto e arquivo)
const userData = { message: "", file: {} };

// Cria dinamicamente uma div de mensagem com conteúdo e classes
const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Faz scroll até o final do container de chat
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

// Efeito de digitação, simulando a resposta do bot "escrevendo"
const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;

  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval); // para o efeito de digitação
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 40);
};

// Envia mensagem para a API e lida com a resposta do Gemini
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();

  // Adiciona a mensagem do usuário ao histórico do chat
  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data
        ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }]
        : [])
    ]
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal // permite cancelar a requisição se necessário
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    // Extrai e limpa o texto da resposta da API
    const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();

    // Ativa o efeito de digitação no chat
    typingEffect(responseText, textElement, botMsgDiv);

    // Salva a resposta do modelo no histórico
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  } catch (error) {
    textElement.style.color = "#d62939";
    textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
  } finally {
    userData.file = {}; // limpa o arquivo após enviar
  }
};

// Lida com o envio do formulário (mensagem do usuário)
const handleFormSubmit = (e) => {
  e.preventDefault(); // impede reload da página

  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  promptInput.value = "";
  userData.message = userMessage;
  document.body.classList.add("bot-respondimg", "chats-active"); // ativa estilos

  // Remove classes de upload de arquivo, se houver
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

  // HTML da mensagem do usuário
  const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data
      ? userData.file.isImage
        ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
        : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
      : ""
    }
  `;

  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  // Cria mensagem "pensando..." do bot e depois chama a API
  setTimeout(() => {
    const botMsgHTML = `<i class='bx bxs-invader' style='color:#0049c5'  ></i>
      <p class="message-text">Espere Edu pensar...</p>`;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

// Quando o usuário seleciona um arquivo
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

    // Preenche os dados do arquivo em base64
    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage
    };
  };
});

// Botão de cancelar upload de arquivo
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

// Botão de parar a geração da resposta
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  userData.file = {};
  controller?.abort(); // aborta a chamada da API
  clearInterval(typingInterval); // para o efeito de digitação
  chatsContainer.querySelector(".bot-message.loading").classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

// Botão de deletar todos os chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("bot-responding", "chats-active");
});

// Sugestões clicáveis: preenchem o input e enviam
document.querySelectorAll(".suggestions-item").forEach(item => {
  item.addEventListener("click", () => {
    promptInput.value = item.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit")); // dispara envio do form
  });
});

// Mostra ou oculta botões de controle com base em onde o usuário clica
document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") || (
    wrapper.classList.contains("hide-controls") &&
    (target.id === "add-file-btn" || target.id === "stop-response-btn")
  );
  wrapper.classList.toggle("hide-controls", shouldHide);
});

// Alterna entre tema claro e escuro
themeToggle.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

// Aplica o tema salvo no localStorage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Envia a mensagem ao apertar Enter no form
promptForm.addEventListener("submit", handleFormSubmit);

// Botão "adicionar arquivo" dispara o seletor de arquivo
promptForm.querySelector("#ad-file-btn").addEventListener("click", () => fileInput.click());
