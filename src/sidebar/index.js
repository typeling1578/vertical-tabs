import TabCenter from "./tabcenter.js";

// Start-it up!
const tabCenter = new TabCenter();
tabCenter.init();

// For testing!
window.tabCenter = tabCenter;

// alert/confirm/prompt dialogs do not work properly in the sidebar
// https://gist.github.com/tim-we/592e271c9517af6b9bcaadd811056d26
(function(){
  let _confirm = window.confirm;
  let bg = null;

  function addBackgroundElement() {
    bg = document.createElement("div");
    bg.style.position = "fixed";
    bg.style.top = "0px";
    bg.style.bottom = "0px";
    bg.style.left = "0px";
    bg.style.right = "0px";
    bg.style.backgroundColor = "white";
    bg.style.zIndex = "9999";
    document.body.appendChild(bg);
  }

  function removeBackgroundElement() {
    document.body.removeChild(bg);
  }

  // apply fix
  window.confirm = text => {
    addBackgroundElement();
    let res = _confirm(text);
    removeBackgroundElement();
    return res;
  };
})();
