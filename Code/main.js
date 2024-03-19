import "./style.css";
import {/* setupHelp */ setupButton, setupSelect } from "./dmfinalproj.js";                                    //i can import here setupselect

document.querySelector("#app").innerHTML = `
  <div>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
  </div>
`;
setupSelect(document.querySelector("#select"));
setupButton(document.querySelector("#counter"));
/* const helpButton = document.getElementById("helpButton")
setupHelp(helpButton); */

