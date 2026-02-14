const hair = document.getElementById("hair");
const body = document.getElementById("body");
const nameText = document.getElementById("charName");

document.getElementById("hairColor").addEventListener("input", e => {
  hair.style.background = e.target.value;
});

document.getElementById("bodyColor").addEventListener("input", e => {
  body.style.background = e.target.value;
});

document.getElementById("nameInput").addEventListener("input", e => {
  nameText.textContent = e.target.value || "Your Name";
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  html2canvas(document.querySelector("#character")).then(canvas => {
    const link = document.createElement("a");
    link.download = "haki-character.png";
    link.href = canvas.toDataURL();
    link.click();
  });
});
