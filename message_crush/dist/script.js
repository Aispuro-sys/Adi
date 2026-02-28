const wrapper = document.getElementById("wrapper");
const question = document.getElementById("question");
const gif = document.getElementById("gif");
const yesBtn = document.getElementById("yes-btn");

yesBtn.addEventListener("click", () => {
  question.innerHTML = "💕 Gracias por quererme... 💕<br><br>Quiero que sepas que siempre estaré contigo, en los días buenos y en los malos.<br><br>Cuando todo esté oscuro, seré tu luz. Cuando estés triste, seré tu abrazo. Cuando el mundo pese demasiado, cargaré contigo.<br><br>Nunca estarás sola mientras yo exista. 🦊❤️<br><br><span style='font-size: 0.8em; opacity: 0.8;'>— Tu Lalito</span>";
  gif.src = "https://media.giphy.com/media/UMon0fuimoAN9ueUNP/giphy.gif";
  yesBtn.innerHTML = "¡Te quiero! 💕";
  yesBtn.style.background = "linear-gradient(135deg, #ffd700, #ffb347)";
  yesBtn.style.cursor = "default";
  yesBtn.onclick = null;
});