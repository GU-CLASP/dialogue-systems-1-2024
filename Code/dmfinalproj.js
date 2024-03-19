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
    asrDefaultNoInputTimeout: 50000,
    locale: "en-US",
    ttsDefaultVoice: "en-US-MichelleNeural", //"JANE,AVA,Monica"
};

const namespeople = ["Carmen", "Joe", "Victor", "Isabelle", "Sarah", "Anne", "Eric", "Maria", "Bernard", "Frank", "Anita", "Sophie", "Hans", "Stephen"];

const persinfo = {
    "Carmen": {
        "gender": ["woman", "female", "girl"],
        "hair": ["brown hair", "short hair", "hair short", "hair brown", "brunette"], //it needs to be a pair in nlu and here otherwise it doesnt recognize it 
        "accessories": "no",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["dark skin", "brown skin", "skin brown", "skin dark", "darker skin", "skin darker"],
        "beard": "no",
    },

    "Joe": {
        "gender": ["man", "male", "boy"],
        "hair": ["blonde hair", "short hair", "hair short", "hair blonde", "blonde"],
        "accessories": "no",
        "eyes": ["blue eyes", "eyes blue"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Victor": {
        "gender": ["man", "boy", "male"],
        "hair": ["white hair", "short hair", "hair short", "hair white"],
        "accessories": "no",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Isabelle": {
        "gender": ["woman", "female", "girl"],
        "hair": ["red hair", "long hair", "hair long", "hair red"],
        "accessories": "no",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Sarah": {
        "gender": ["woman", "female", "girl"],
        "hair": ["blonde hair", "short hair", "hair short", "hair blonde", "blonde"],
        "accessories": ["hat", "glasses", "earrings"],
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Anne": {
        "gender": ["woman", "female", "girl"],
        "hair": ["white hair", "short hair", "hair short", "hair white"],
        "accessories": ["earrings", "glasses"],
        "eyes": ["blue eyes", "eyes blue"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },
    "Eric": {
        "gender": ["man", "boy", "male"],
        "hair": ["blonde hair", "short hair", "hair short", "hair blonde", "blonde"],
        "accessories": "hat",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Maria": {
        "gender": ["woman", "female", "girl"],
        "hair": ["brown hair", "short hair", "hair short", "hair brown", "brunette"],
        "accessories": ["earrings", "hat"],
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Bernard": {
        "gender": ["man", "boy", "male"],
        "hair": ["brown hair", "short hair", "hair short", "hair brown", "brunet"],
        "accessories": "hat",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["dark skin", "brown skin", "skin brown", "skin dark", "darker skin", "skin darker"],
        "beard": "no",
    },

    "Frank": {
        "gender": ["man", "boy", "male"],
        "hair": ["black hair", "short hair", "hair short", "hair black", "brunet"],
        "accessories": "hat",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin white", "skin light", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Anita": {
        "gender": ["woman", "female", "girl"],
        "hair": ["blonde hair", "short hair", "hair short", "hair blonde", "blonde"],
        "accessories": "no",
        "eyes": ["blue eyes", "eyes blue"],
        "colorskin": ["white skin", "light skin", "skin light", "skin white", "lighter skin", "skin lighter"],
        "beard": "no",
    },

    "Sophie": {
        "gender": ["woman", "female", "girl"],
        "hair": ["black hair", "long hair", "hair black", "hair long", "brunette"],
        "accessories": "glasses",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["dark skin", "brown skin", "skin brown", "skin dark", "darker skin", "skin darker"],
    },


    "Hans": {
        "gender": ["man", "boy", "male"],
        "hair": ["blonde hair", "short hair", "hair short", "hair blonde", "blonde"],
        "accessories": "no",
        "eyes": ["brown eyes", "eyes brown"],
        "colorskin": ["white skin", "light skin", "skin white", "skin light", "lighter skin", "skin lighter"],
        "beard": ["mustache", "beard"],
    },

    "Stephen": {
        "gender": ["man", "boy", "male"],
        "hair": ["red hair", "short hair", "hair short", "hair red"],
        "accessories": "no",
        "eyes": ["blue eyes", "eyes blue"],
        "colorskin": ["white skin", "light skin", "skin white", "skin light", "lighter skin", "skin lighter"],
        "beard": ["mustache", "beard"],
    },


};



// function check the person yes or no 



//random select of the person 
function selectcharacter(myarray) {
    const randomIndex = Math.floor(Math.random() * myarray.length);
    return myarray[randomIndex];
}

const choice = selectcharacter(namespeople)
console.log("choice:", choice)
//console.log(selectcharacter[choice])

const chosenCharacter = persinfo[choice];
console.log("Character information:", chosenCharacter);



const IsCharacterselected = ({ context }) => {
    return choice !== '';
}


const dearClient = ["Do you still want to play the gamwe?", "Are you there?", "If you do not want to continue just click X"];
function randomRepeat(myarray) {
    const randomIndex = Math.floor(Math.random() * myarray.length);
    return myarray[randomIndex];
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
        beard: '',
        reprompt: 0,

    },
    id: "DM",
    initial: "Prepare",
    states: {
        Prepare: {
            entry: [
                assign({
                    ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
                    // choice: selectcharacter(namespeople),
                }),
                ({ context }) => context.ssRef.send({ type: "PREPARE" }),
            ],
            on: { ASRTTS_READY: "WaitToStart" },
        },
        WaitToStart: {
            /*     after: {
                        "1000": "PromptAndAsk"
                    }, */
            on: {
                CLICK: "PromptAndAsk"
            }
        },
        PromptAndAsk: {
            initial: "Prompt",
            states: {


                /* {
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
                    }, */

                Prompt: {
                    entry: [chosenCharacter,
                        {
                            type: "say",
                            params: `Welcome to the guess who game. In this game I will be a person from the images that you see and you have to ask me yes or no questions for my gender, my hair, my eyes, my colorskin or my accessories, until you manage to find my character. Do you want to start?`,
                        }],

                    on: { SPEAK_COMPLETE: "yesornostartgame" },
                },
                //yes or no if he want to start orno
                yesornostartgame: {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                        ASR_NOINPUT: //"Canthear1",
                            [{
                                guard: ({ context }) => context.reprompt <= 1,
                                target: "Canthear1",
                                actions: ({ context }) => context.reprompt++
                            },
                            {
                                guard: ({ context }) => context.reprompt > 2,
                                target: "#DM.Done"
                            }],

                        RECOGNISED: [

                            {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "DontunderstandYesNo"},
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

                DontunderstandYesNo: {
                    entry: [{
                        type: "say",
                        params: `Sorry, I didnt understand you. Do you want to play?`,
                    }],
                    on: { SPEAK_COMPLETE: "yesornostartgame"}
                },

                Startgame: {
                    entry: [{
                        type: "say",
                        params: `Okay, let's start`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },//"AccessoriesQuestion" Genderquestion,
                },


                QuestionsState: {
                    entry: [{
                        type: "listen"
                    }],
                    on: {
                        ASR_NOINPUT: //"Canthear2",
                            [{
                                guard: ({ context }) => context.reprompt <= 1,
                                target: "Canthear2",
                                actions: ({ context }) => context.reprompt++
                            },
                            {
                                guard: ({ context }) => context.reprompt > 2,
                                target: "#DM.Done"
                            }],


                        RECOGNISED: [

                            //GUARD DONTUNDERSTAND 
                            {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand"},

                            //GUARD GENDER
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "gender" && chosenCharacter.gender.includes(event.nluValue.entities[0].text),//chosenCharacter["gender"] === event.nluValue.entities[0].text,//chosenCharacter.gender.includes(event.nluValue.entities[0].text), 
                                actions: assign({ gender: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswergender"
                            },
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "gender" && not(chosenCharacter.gender.includes(event.nluValue.entities[0].text)),
                                target: "Negativeanswergender"
                            },

                            //  THIS JUST CHECKS THE FIRST GUARD AND DOESNT CHECK THE OTHER ONES
                            /* {guard: ({ event }) => chosenCharacter.gender.includes(event.nluValue.entities[0].text),//chosenCharacter["gender"] === event.nluValue.entities[0].text,//chosenCharacter.gender.includes(event.nluValue.entities[0].text), 
                                actions: assign({ gender: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswer"
                            },
                            {guard: ({ event }) => not(chosenCharacter.gender.includes(event.nluValue.entities[0].text)),
                            target: "Negativeanswer" }, */

                            //GUARD HAIR
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "hair" && chosenCharacter.hair.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,
                                actions: assign({ hair: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswerhair"
                            },
                            { guard: ({ event }) => event.nluValue.entities[0].category === "hair" && not(chosenCharacter.hair.includes(event.nluValue.entities[0].text)), target: "Negativeanswerhair" },

                            //GUARD ACCESSORIES
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "accessories" && chosenCharacter.accessories.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,
                                actions: assign({ accessories: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveansweraccessories"
                            },

                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "accessories" && not(chosenCharacter.accessories.includes(event.nluValue.entities[0].text)),
                                target: "Negativeansweraccessories"
                            },

                            //GUARD EYES
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "eyes" && chosenCharacter.eyes.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,
                                actions: assign({ eyes: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswereyes"
                            },

                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "eyes" && not(chosenCharacter.eyes.includes(event.nluValue.entities[0].text)),
                                target: "Negativeanswereyes"
                            },


                            // GUARD ACCESSORIES
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "beard" && chosenCharacter.beard.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,
                                actions: assign({ beard: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswerbeard"
                            },

                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "beard" && not(chosenCharacter.beard.includes(event.nluValue.entities[0].text)),
                                target: "Negativeanswerbeard"
                            },
                            //{action: [{type: "say", params: `no, this is not my gender`}],}, //this doesnt work  its like it works randomly  


                            // GUARD COLORSKIN
                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "colorskin" && chosenCharacter.colorskin.includes(event.nluValue.entities[0].text), //includes in order to access the array 
                                //{guard: ({event}) => chosenCharacter.accessories === event.nluValue.entities[0].text,
                                actions: assign({ colorskin: ({ event }) => event.nluValue.entities[0].text }),
                                target: "Positiveanswercolorskin"
                            },

                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "colorskin" && not(chosenCharacter.colorskin.includes(event.nluValue.entities[0].text)),
                                target: "Negativeanswercolorskin"
                            },

                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "namespeople" && event.nluValue.entities[0].text.includes(choice),
                                target: "foundcharacter"
                            },

                            {
                                guard: ({ event }) => event.nluValue.entities[0].category === "namespeople" && not(event.nluValue.entities[0].text.includes(choice)),
                                target: "notfoundcharacter"
                            },

                            {guard:({event}) => event.value.entities.length === 0 , target : "Dontunderstand"},  
                            //{target: "Dontunderstand"}, 
                            /* {
                                guard: ({ event }) => event.nluValue.topIntent === "question" && entityarray.lentgh === 0,
                                target: "Dontunderstand"
                            }, */

                        ],

                    },
                },


                Dontunderstand: {
                    entry: [{
                        type: "say",
                        params: `I am sorry but I don't understand you. Please ask me something else`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },

                Canthear1: {
                    entry: ({ context }) =>
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                                utterance: randomRepeat(dearClient),
                            },
                        }),
                    on: {
                        SPEAK_COMPLETE: "yesornostartgame",
                    },

                },

                Canthear2: {
                    entry: ({ context }) =>
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                                utterance: randomRepeat(dearClient),
                            },
                        }),
                    on: {
                        SPEAK_COMPLETE: "QuestionsState",
                    },

                },


                foundcharacter: {
                    entry: [{
                        type: "say",
                        params: `Yes, you found me`,
                    }],
                    on: { SPEAK_COMPLETE: "Endgame" },

                },

                Endgame: {
                    entry: [{
                        type: "say",
                        params: `Thank you for playing the guess who game`,
                    }],
                    on: { SPEAK_COMPLETE: "#DM.Done" },
                },


                notfoundcharacter: {
                    entry: [{
                        type: "say",
                        params: `No, this is not me`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },

                },



                Positiveanswercolorskin: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const colorskin = context.colorskin;
                            return `Yes, I have ${colorskin}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },

                Negativeanswercolorskin: {
                    entry: [{
                        type: "say",
                        params: `No, this is not my colorskin`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },




                Positiveanswerbeard: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const beard = context.beard;
                            return `Yes, I have ${beard}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },


                Negativeanswerbeard: {
                    entry: [{
                        type: "say",
                        params: `No, I don't`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },


                Positiveanswereyes: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const eyes = context.eyes;
                            return `Yes, I have ${eyes}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },

                Negativeanswereyes: {
                    entry: [{
                        type: "say",
                        params: `No, this is not the color of my eyes`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },



                Positiveanswergender: {
                    entry: [{
                        type: "say",
                        params: `Yes, you found my gender`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },
                Negativeanswergender: {
                    entry: [{
                        type: "say",
                        params: `No, this is not my gender`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },


                Positiveanswerhair: {
                    entry: [{
                        type: "say",
                        params: `Yes, that's my hair`,
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },


                Negativeanswerhair: {
                    entry: [{
                        type: "say",
                        params: `No, that's not my hair`,
                                      //i want to return the nluvalueentity so it says no i dont have brown hair 
                        
                        
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },



                Positiveansweraccessories: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const accessories = context.accessories;
                            return `Yes, I wear ${accessories}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },


                Negativeansweraccessories: {
                    entry: [{
                        type: "say",
                        params: ({ context }) => {
                            const accessories = context.accessories;   //i want to return the nluvalueentity so it says no i dont wear glasses
                            return `No, I do not wear ${accessories}`;
                        },
                    }],
                    on: { SPEAK_COMPLETE: "QuestionsState" },
                },


                /* help: {
                        entry: [{
                            type: "say",
                            params: `Ask about the eyes colour`,
                        }],
                    on: {  SPEAK_COMPLETE: "QuestionsState" },
                },
 */





            },
        },

        Done: {
            on: {
                CLICK: "PromptAndAsk"
            }
        },

    },
});



const dmActor = createActor(dmMachine, {
    inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
    console.log(state)
});

export function setupButton(element) {
    element.addEventListener("click", () => {
        dmActor.send({ type: "CLICK" });
    })
};

/* export function setupHelp(element, dmActor) {
    element.addEventListener("click", () => {
        dmActor.send({ type: "help" });
    })};  */


/* dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
}); */





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
    const startButtonDiv = document.getElementById("startButton")
    const selectOptionsDiv = document.getElementById("selectOptions")
    //const helpButtonDiv = document.getElementById("helpButton")
    setupSelect(selectOptionsDiv);
    setupButton(startButtonDiv);
    //setupHelp(helpButtonDiv);

    //const buttonElement = document.getElementById()
}; 
