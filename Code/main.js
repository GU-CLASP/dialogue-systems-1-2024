import "./style.css";
//import { setupButton } from "./dm.js";
//import { setupButton } from "./dm3.js";
//import { setupButton } from "./dm4.js";
import { setupButton } from "./dm5.js";

document.querySelector("#app").innerHTML = `
  <div>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
  </div>
`;

setupButton(document.querySelector("#counter"));
