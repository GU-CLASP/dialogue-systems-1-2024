import { not, assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { NLU_KEY, KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
    endpoint:
        "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
    key: KEY,
};

const azureLanguageCredentials = {
    endpoint: "https://languageresource26.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
    key: NLU_KEY /** reference to your Azure CLU key */,
    deploymentName: "guesswhogame" /** your Azure CLU deployment */,
    projectName: "guesswhogame" /** your Azure CLU project name */,
};


const settings = {
    azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
    azureCredentials: azureCredentials,
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 5000,
    locale: "en-US",
    ttsDefaultVoice: "en-US-DavisNeural",
};

const namespeople = ["Carmen", "Joe", "Victor", "Isabelle", "Sarah", "Anne", "Eric", "Maria", "Bernard", "Frank","Anita"]; 

const persinfo = {
    "Carmen": {
        "gender": ["woman", "female", "girl"],  
        "hair": ["brown hair", "short hair",], //it needs to be a pair in nlu and here otherwise it doesnt recognize it 
        "accessories": "no",        
        "eyes": "brown",
        "colorskin": ["dark", "brown"]
    },

    "Joe": {
        "gender": ["man", "male", "boy"],
        "hair": ["blonde hair", "short hair"],
        "accessories": "no",
        "eyes": "blue",
        "colorskin": ["white", "light"]
    },

    "Victor": {
        "gender": ["man", "boy", "male"],
        "hair": ["white hair", "short hair",],
        "accessories": "no",
        "eyes": "blue",
        "colorskin": ["white", "light"]
    },

    "Isabelle": {
        "gender": ["woman", "female", "girl"],
        "hair": ["long hair", "red hair"],
        "accessories": "no",
        "eyes": "brown",
        "colorskin": ["white", "light"],
    },

    "Sarah": {
        "gender": ["woman", "female", "girl"],
        "hair": ["blonde hair", "short hair",],
        "accessories": ["hat", "glasses"],
        "eyes": "brown",
        "colorskin": ["white", "light"]
    },

    "Anne": {
        "gender": ["woman", "female", "girl"],
        "hair": ["white hair", "short hair",],
        "accessories": ["earrings", "glasses"],
        "eyes": "blue",
        "colorskin": ["white", "light"],
    },
    "Eric": {
        "gender": ["man", "boy", "male"],
        "hair": ["blonde hair", "short hair",],
        "accessories": "hat",
        "eyes": "brown",
        "colorskin": ["white", "light"],
    },

    "Maria": {
        "gender": ["woman", "female", "girl"],
        "hair": ["brown hair", "short hair",],
        "accessories": ["earrings", "hat"],
        "eyes": "brown",
        "colorskin": ["white", "light"],
    },

    "Bernard": {
        "gender": ["man", "boy", "male"],
        "hair": ["brown hair", "short hair",],
        "accessories": "hat",
        "eyes": "brown",
        "colorskin": ["dark", "brown"],
    },

    "Frank": {
        "gender": ["man", "boy", "male"],
        "hair": ["brown hair", "short hair",],
        "accessories": "hat",
        "eyes": "brown",
        "colorskin": ["white", "light"],
    },

    "Anita": {
        "gender": ["woman", "female", "girl"],
        "hair": ["blonde hair", "short hair",],
        "accessories": "no",
        "eyes": "blue",
        "colorskin": ["white", "light"],
    },




};

/* Grammar definition */

// function check the person yes or no 



//random select of the person 
function selectcharacter(myarray) {
    const randomIndex = Math.floor(Math.random() * myarray.length);
    return myarray[randomIndex];
}

const choice = selectcharacter(namespeople)
//console.log(selectcharacter[choice])

const chosenCharacter = persinfo[choice];
console.log("Character information:", chosenCharacter);

function GetHairStyle(choice) {
    const hairStyle = chosenCharacter["hair"];
    return chosenCharacter["hair"];
}


function GetEyetype(choice) {
    //const chosenCharacter = persinfo[choice];
    return chosenCharacter["eye"];
}

function GetAccessories(choice) {
    //const chosenCharacter =persinfo[choice];
    return chosenCharacter["accessories"];
}

function GetGender(choice) {
    //const chosenCharacter = persinfo[choice];
    return chosenCharacter["gender"];
}

const IsCharacterselected = ({ context }) => {
    return choice !== '';
}


const dearClient = ["Are you there", "talk to me"];
function randomRepeat(myarray) {
    const randomIndex = Math.floor(Math.random() * myarray.length);
    return myarray[randomIndex];
}


function matchEntityWithAccessories(entity, choice) {
    const characterAccessories = persinfo[chosenCharacter].accessories;
    return characterAccessories.toLowerCase() === entity.toLowerCase();
}



/* Helper functions */
function isInGrammar(utterance) {
    return utterance.toLowerCase() in grammar;
    //this gives back the nickname, key returns a boolean
}



function IsPositive(event) {
    return event === "positiveanswer";
}

function IsNegative(event) {
    return event === "negativeanswer";
}



const dmMachine = setup({
    actions: {
        /* define your actions here */
        say: ({ context }, params) =>
            context.ssRef.send({
                type: "SPEAK",
                value: {
                    utterance: params,
                },
            }),
        listen: ({ context }) =>
            context.ssRef.send({
                type: "LISTEN",
                value: { nlu: true } /** Local activation of NLU */,
            }),
    },
}).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwA2RQFYuAdi4AOACzaDexQBoQAT0QBGe3vTa1btduMBmRXrXGnAF9A6zR0AHUCcWpBcjEiMWIAYQAZAEkkgGluPiQQIVEJaVkFBEU1VR1rOwQAWnsvbXRy9zVFLwMNLm1tYNCMSOjY+OxEuVh4sTB0AgAzKewACnsVLgBKYjDBsRi4hJzZAvFJGTzS8srtasR6wy9m1raOri6evpAwnEEAWzwxUikEFIsAA1ugkgALMAAYxB0IhRAI0IWsDAABsYUUpMQDnkjliSogvPZDOgVqsNCtGvZtBprgg9MZjOhjKsuKzjHoNNpFO9Ptgfn8AUDQeCobD4YjkWBsKiMciTjj7LkBMJjsUzkSSWS2ZSuNTafTDFx7OguqtjIYVq4aXyMF9fv9AcCwZCpQtyOjMYqRjAxLjVYUToSylb0F42RHtE4zIYjdpScbVj09I0I2o7VgBY7hS6s4LEuRMCxMvQkgB5VCYFJMahMAP5NUEzUIYxqe4kvTRk2MjRuenc0ms1ZOQy0lOZh1C52imxwQTYKTCEZiKAEb5gYjMCsAcQAcmlyExkA38cGW75nF4Oro1DSeammfS2qpdBTrxpOezJ9npyKwXOsALkuEwJGuG5bkwu4HkeJ7KocTbnqA5x6FeN5cHePS+F4T62IgaiGIozRsgYbisgRP4Frmop7KM4GbkWJZlpW1a1vWvAIUGGrIUoxhEYoWi6KYqEaF4GgWPSKzeOoJGGFoOH+JROYzmCO5gICMoAI4AK5wFikHQYex6noh3HyEoWjoGOFJUtGhp4QgjjdGabJyToiiGIYGYhB89q-k6-7oGpGnYDpemKtu5b7kZcEqo2XGnDxZSWdZKh6gadIOfYij2My3QqA0yjlDoGhKX+eaYIhABuYAEFIsAAO4ysQjGkKWFZVjWdYmQlIY6MyVRZb4TRdgVXiaAm3JlQFeZ7mAa4SDVdWNc1rXtSxXXsXFZ5meclkEaNUYxnocZZdezimAVnIecapjTdRYKkNC0JwEB2AiHAACKukTBFUFRTBxkcXipmJeZZTti4OgqJhD44cYknjWoZJvjSbZOEy90qegT0vbAb0fbA33hdIBkAzFHDwSDvUXpDPJvrD2G4TUNL6C5KjKC87bGnoWOBZVQZLfVTXYEieME3ALXFm1zGdWxPXqmDpQ+Mj-juH2lqKHxVhZbSyMRhzRg+D4Jp87N80EIttXCzKYuvQuhNS0xHWsd1wOBorIbXqSGiGF2kmiaabI5a49OaMEPlLhAcCyGgnGey2tSaPStS+Ko5omjlVoVOdP74EQYDx82SV8UapotGRdziZyej2Jm2y7CuRdIeDZj0gmRGMurd53iY3n9Pmyn-s3u03Ja7eclZbIkjn3S8z5-JUdjkIwnCCKi9KspegqZk7UriBcJJjhNOSqxuAm-heGbopuhvHrb8X8UJ0lh9DW27Nnx4XneNfYJTmII994IGvANaG+oMKZ0InoAcjQdRsnPt-XkC8-JL0CoBYCy4wLrkLtTZ+4NX4s28KoCoFp2Rch5HXZBg9yo0RXPRQBIYCEOEpPxEiGF-CUIHv-B6QV1LR1Cj9R+e9GGST8PcN8JoTTRnsOJQwv8sDVWtitbADCWxMMcmoRkU8xpFTaLSeRc0FoiCFso1RL96Qhw0HAk0gljC+xwvI3G9t3pfUES3YRaiLHnRZCOdsLwmScN8tQmaooBbHBMSLO2+MHYx1wY-Uo6idDagMBzdoCZ7BuAMRbK2y1InPWcYTMx+CLEpPQMHTw7CzAR0CEAA */
    context: {
        count: 0,
        choice: '',
        hair: '',
        eyes: '',
        accessories: '',
        colorskin: '',
        gender: '',

    },
    id: "DM",
    initial: "Prepare",
    states: {
        Prepare: {
            entry: [
                assign({
                    ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
                    choice: selectcharacter(namespeople),
                }),
                ({ context }) => context.ssRef.send({ type: "PREPARE" }),
            ],
            on: { ASRTTS_READY: "WaitToStart" },
        },
        WaitToStart: {
        after: {
                "1000": "PromptAndAsk"
            }, 
            on: {
                CLICK: "PromptAndAsk"
            }
        },
        PromptAndAsk: {
            initial: "Checkcharacterselection",
            states: {
                Checkcharacterselection: {
                    always: [
                        { guard: IsCharacterselected, target: "Prompt" },

                        { target: "CharacterSelection" },

                    ],
                }, 

                CharacterSelection: {
                    entry: [
                        assign({ choice: selectcharacter(namespeople) })
                    ],
                    on: {
                        target: "Prompt",
                    },
                },

                Prompt: {
                    entry: [{
                        type: "say",
                        params: //` Let's start the guess who game. In this game I will be a person from the images that you see and you have to ask me things for my hair, my eyes, my colorskin or my accessories. 
                            `Do you want to start?`,
                    }],

                    on: { SPEAK_COMPLETE: "yesornostartgame" },
                },
                //yes or no if he want to start orno
                yesornostartgame: {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                        RECOGNISED: [
                            {
                                guard: ({ event }) => IsPositive(event.nluValue.entities[0].category),
                                target: "Startgame"
                            },
                            {
                                guard: ({ event }) => IsNegative(event.nluValue.entities[0].category),
                                target: "#DM.PromptAndAsk.Prompt"
                            },
                        ]
                    },
                },


                Startgame: {
                    entry: [{
                        type: "say",
                        params: `Okay, let's start with my hair`,
                    }],
                    on: { SPEAK_COMPLETE: "HairQuestion" },//"AccessoriesQuestion" Genderquestion,
                },

                Genderquestion: {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                        RECOGNISED: [
                            {
                                guard: ({ event }) => chosenCharacter.gender.includes(event.nluValue.entities[0].text),//chosenCharacter["gender"] === event.nluValue.entities[0].text,//chosenCharacter.gender.includes(event.nluValue.entities[0].text), 
                                actions: assign({ gender: ({ event }) => event.nluValue.entities[0].text }),
                                //target : "Positiveanswer"
                                target: "Positiveanswer"
                            },
                            { target: "Negativeanswer" }
                            //{action: [{type: "say", params: `no, this is not my gender`}],}, //this doesnt work  its like it works randomly  
                        ],
                    },
                },

                Positiveanswer: {
                    entry: [{
                        type: "say",
                        params: `Yes, you found my gender`,
                    }],
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                },
                Negativeanswer: {
                    entry: [{
                        type: "say",
                        params: `No, you have to try again`,
                    }],
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                },

                HairQuestion: {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                        RECOGNISED: [
                            {
                                guard: ({ event }) => chosenCharacter.hair.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,

                                actions: assign({ hair: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswerhair"
                            },


                            { target: "Negativeanswerhair" },
                        ],
                    },
                },

                Positiveanswerhair: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const hair = context.hair;
                            return `Yes, I have ${hair}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                },
                Negativeanswerhair: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const hair = context.hair;     //i want to return the nluvalueentity so it says no i dont have brown hair 
                            return `No, I do not have ${hair}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                },




                AccessoriesQuestion: {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                        RECOGNISED: [
                            {
                                guard: ({ event }) => chosenCharacter.accessories.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,

                                actions: assign({ accessories: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveansweraccessories"
                            },


                            { target: "Negativeansweraccessories" }
                        ],
                    },
                },

                Positiveansweraccessories: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const accessories = context.accessories;
                            return `Yes, I wear ${accessories}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                },
                /* Positiveansweraccessories: {
                    entry: [{
                        type: "say",
                        params: ({ event }) => `Yes, I wear ${event.nluValue.accessories[0].text}`,
                    }],           
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                }, */

                Negativeansweraccessories: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const accessories = context.accessories; //i want to return the nluvalueentity so it says no i dont wear glasses
                            return `No, I do not wear ${accessories}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "AccessoriesQuestion" },
                },




                /*  [
                    {guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text, //chosenCharacter["gender"] === event.nluValue.entities[0].text,//chosenCharacter.gender.includes(event.nluValue.entities[0].text), 
                    //console.log(chosenCharacter.accessories);
                    actions: assign({accessories: ({event}) => event.nluValue.entities[0].text
                    }),
                    target : "Positiveanswer"
                    //actions:[{type: "say", params: `yes`}],
                },
                {target: "Negativeanswer"}
                //{action: [{type: "say", params: `no`}],},
            ],
                
     */

                /* Genderquestion: {
                    entry: [{
                        type: "listen"
                    }],
        
        
                    RECOGNISED: [
                        {guard: ({event}) => chosenCharacter.gender === event.nluValue.entities[0].text,//chosenCharacter["gender"] === event.nluValue.entities[0].text,//chosenCharacter.gender.includes(event.nluValue.entities[0].text), 
                        actions: assign({gender: ({event}) => event.nluValue.entities[0].text
                        }),
                        target : "Positiveanswer"
                        //actions:[{type: "say", params: `yes`}],
                    },
                    {target: "Negativeanswer"}
                    //{action: [{type: "say", params: `no`}],},
                ],
                }, */






                /* Startgame : {
                    entry: [{
                        type: "say",
                        params: `Okay, let's start with my hair`,
                    }],                     
                    on: { SPEAK_COMPLETE: "Hairquestion" },
                },
        
                Hairquestion : {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                    RECOGNISED: [
                            {guard: ({event}) => chosenCharacter["hair"] === event.nluValue.entities[0].text,
                            actions:[{type: "say", params: `yes`}],
                            //actions: assign({hair: ({event}) => event.nluValue.entities[0].text
                            //}),
                            target: "Eyesquestion"},
                    ]},},
        
                    Eyesquestion : {
                        entry: [{
                            type: "say",
                            params: `You found my hair, so now you have to find the color of my eyes`,
                        }],                     
                        on: { SPEAK_COMPLETE: "Hairquestion" },
                    }, */













            },
        },

    },
},)



const dmActor = createActor(dmMachine, {
    inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
    console.log(state)
});

// export function setupButton(element) {
// element.addEventListener("click", () => {
//     dmActor.send({ type: "CLICK" });
// }); 


dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
});





//images selection

export function setupSelect(element) {


    //const image1Button = document.getElementById("image1");
    const image2Button = document.getElementById("image2");
    const image3Button = document.getElementById("image3");
    const image4Button = document.getElementById("image4");
    //const image5Button = document.getElementById("image5");
    //const image6Button = document.getElementById("image6");
    const image7Button = document.getElementById("image7");
    const image8Button = document.getElementById("image8");
    const image9Button = document.getElementById("image9");
    //const image10Button = document.getElementById("image10");
    const image11Button = document.getElementById("image11");
    //const image12Button = document.getElementById("image12");
    const image13Button = document.getElementById("image13");
    //const image14Button = document.getElementById("image14");
    const image15Button = document.getElementById("image15");
    const image16Button = document.getElementById("image16");
    //const image17Button = document.getElementById("image17");
    //const image18Button = document.getElementById("image18");
    const image19Button = document.getElementById("image19");
    //const image20Button = document.getElementById("image20");
    const image21Button = document.getElementById("image21");
    const image22Button = document.getElementById("image22");
    const image23Button = document.getElementById("image23");



    /* image1Button.addEventListener("click", () => {
        image1Button.style.display = "none";
    }); */
    image2Button.addEventListener("click", () => {
        image2Button.style.display = "none";
    });
    image3Button.addEventListener("click", () => {
        image3Button.style.display = "none";
    });
    image4Button.addEventListener("click", () => {
        image4Button.style.display = "none";
    });
    /* image5Button.addEventListener("click", () => {
        image5Button.style.display = "none";
    }); */
    /* image6Button.addEventListener("click", () => {
        image6Button.style.display = "none";
    }); */
    image7Button.addEventListener("click", () => {
        image7Button.style.display = "none";
    });
    image8Button.addEventListener("click", () => {
        image8Button.style.display = "none";
    });
    image9Button.addEventListener("click", () => {
        image9Button.style.display = "none";
    });
    /* image10Button.addEventListener("click", () => {
        image10Button.style.display = "none";
    }); */
    image11Button.addEventListener("click", () => {
        image11Button.style.display = "none";
    });
    /* image12Button.addEventListener("click", () => {
        image12Button.style.display = "none";
    }); */
    image13Button.addEventListener("click", () => {
        image13Button.style.display = "none";
    });
    /* image14Button.addEventListener("click", () => {
        image14Button.style.display = "none";
    });  */
    image15Button.addEventListener("click", () => {
        image15Button.style.display = "none";
    });
    image16Button.addEventListener("click", () => {
        image16Button.style.display = "none";
    });
/*  image17Button.addEventListener("click", () => {
        image17Button.style.display = "none";
    });
    image18Button.addEventListener("click", () => {
        image18Button.style.display = "none";
    }); */
    image19Button.addEventListener("click", () => {
        image19Button.style.display = "none";
    });
/*  image20Button.addEventListener("click", () => {
        image20Button.style.display = "none";
    }); */
    image21Button.addEventListener("click", () => {
        image21Button.style.display = "none";
    });
    image22Button.addEventListener("click", () => {
        image22Button.style.display = "none";
    });
    image23Button.addEventListener("click", () => {
        image23Button.style.display = "none";
    });









    // for (const option of options) {
    //     const optionButton = document.createElement("button");
    //     optionButton.type = "button";

    //     const img = document.createElement("img");
    //     img.src = option.image;
    //     img.alt = option.image;
    //     optionButton.appendChild(img);

    // img.addEventListener("click", () => {
    //     img.style.display = "none";
    // });

    //         element.appendChild(optionButton);
    //     }
}

window.onload = function () {
    const selectOptionsDiv = document.getElementById("selectOptions")
    setupSelect(selectOptionsDiv);
    //const buttonElement = document.getElementById()
}; 
