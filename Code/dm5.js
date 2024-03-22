import { assign, createActor,not, setup } from "xstate";
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
  deploymentName: "appointment" /** your Azure CLU deployment */,
  projectName: "appointment" /** your Azure CLU project name */,
};


const settings = {
  azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

/* Grammar definition */
const grammar = {
    "rihanna" : {info: "Rihanna is a Barbadian singer, businesswoman, and actress. She is widely regarded as one of the most prominent recording artists of the 21st century"},
    "adele":  {info: 'Adele is an English singer-songwriter. She is known for her mezzo-soprano vocals and sentimental songwriting. Adele has received numerous accolades including 16 Grammy Awards, 12 Brit Awards (including three for British Album of the Year), an Academy Award, a Primetime Emmy Award, and a Golden Globe Award'},
    "lady gaga":{info: "Lady Gaga is an American singer, songwriter and actress. Known for reinventing her image and showcasing versatility in entertainment, she started performing as a teenager by singing at open mic nights and acting in school plays"},
    "madonna":{info: "Madonna is an American singer, songwriter, and actress. Known as the Queen of Pop, she has been widely recognized for her continual reinvention and versatility in music production, songwriting and visual presentation"},
    "leonardo dicaprio": {info:"Leonardo dicaprio is an American actor and film producer. Known for his work in biographical and period films, he is the recipient of numerous accolades, including an Academy Award, a British Academy Film Award, and three Golden Globe Awards"},
    "sam smith": {info: "Sam Smith is an English singer and songwriter. In October 2012, they performed on Disclosure's breakthrough single Latch, which peaked at number eleven on the UK Singles Chart. The following year, they performed on Naughty Boy's 2013 single La La La, which became a number one single on the chart"},
    "taylor swift": {info: "Taylor Swift is an American singer-songwriter. Her artistry and entrepreneurship have influenced the music industry, popular culture, and politics, while her life is a subject of widespread media coverage."},
    "elizabeth taylor": {info: "Elizabeth Taylor was a British and American actress. She began her career as a child actress in the early 1940s and was one of the most popular stars of classical Hollywood cinema in the 1950s."},
    "beyonce": {info: "Beyonce is an American singer, songwriter and businesswoman. Dubbed as Queen Bey and a prominent cultural figure of the 21st century, she has been recognized for her artistry and performances, with Rolling Stone naming her one of the greatest vocalists of all time."},
    "shakira": {info: "Shakira is a Colombian singer and songwriter. Born and raised in Barranquilla, she has been referred to as the Queen of Latin Music and has been praised for her musical versatility."},
  

};



const dearClient = ["Are you there", "talk to me"];
function randomRepeat(myarray){
  const randomIndex =  Math.floor(Math.random() * myarray.length);
    return myarray[randomIndex];
}


/* Helper functions */
function isInGrammar(utterance) {
return utterance.toLowerCase() in grammar;
  //this gives back the nickname, key returns a boolean
}

function getInformationCelebrity(utterance) {
  return (grammar[utterance.toLowerCase()]|| {}).info;
}


function confidencethreshold(event){
    return event >= 0.9;
}

function IsPositive(event){
    return event === "positive";
}

function IsNegative(event) {
    return event === "negative";
}

function helpint(event) {
    return event === "help";
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
  /** @xstate-layout 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-XRaUccSr4bNDuD4KZPQyp6MCEAA */
  context: {
    reprompt: 0,
    celebrity: '',
    name: '',
    day: '',
    time: '',
  },
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: [
        assign({
          ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
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
      initial: "Prompt",
      states: {
        Prompt: {
          entry: [{
            type: "say",
            params: `How can I help you?`,
          }],

          on: { SPEAK_COMPLETE: "intentchoice" },
        },
        intentchoice: {
          entry: "listen",
          on: { 
            ASR_NOINPUT : //"Canthear1",
            [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear1",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],

            RECOGNISED: [
              {guard: ({event}) => event.nluValue.entities.length == 0 ,
                actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand1"},

            {guard: ({event}) => event.nluValue.topIntent === "create a meeting" && confidencethreshold(event.nluValue.intents[0].confidenceScore),
            target: "#DM.PromptAndAsk.Askwithwhom"},
            {guard:({event}) => event.nluValue.topIntent === "create a meeting" && not(confidencethreshold(event.nluValue.intents[0].confidenceScore)),
            target: "EnsureMeeting"},

            {guard: ({event}) => event.nluValue.topIntent === "who is X" && isInGrammar(event.nluValue.entities[0].text) && confidencethreshold(event.nluValue.intents[0].confidenceScore),
            actions: assign({celebrity: ({event}) => event.nluValue.entities[0].text}),
            target: "Celebrityinfo"},
            {guard: ({event}) => event.nluValue.topIntent === "who is X" && not(isInGrammar(event.nluValue.entities[0].text)) && confidencethreshold(event.nluValue.intents[0].confidenceScore),
            target: "DontKnowthisperson"},

          {guard: ({event}) => event.nluValue.topIntent === "who is X" && isInGrammar(event.nluValue.entities[0].text) && not(confidencethreshold(event.nluValue.intents[0].confidenceScore)),
          target: "Ensureperson",
          actions: assign({celebrity: ({event}) => event.nluValue.entities[0].text}),
          },  

          {guard: ({event}) => helpint(event.nluValue.topIntent),
          actions : [{type: "say", params: `We can provide you two things, we can create an appointment for you or give you information for a celebrity`}], 
          target: "#DM.PromptAndAsk.Prompt"},

      ],
      
      },
    },

    Dontunderstand1: {
      entry: [{
          type: "say",
          params: `I am sorry but I don't understand you. Please tell me something else`,
      }],
      on: { SPEAK_COMPLETE: "intentchoice" },
  },

//if we dont have high confidence score we go to the state ensure person for the who is  x state.

Ensureperson:{
    entry: [{
        type: "say",
        params: `Are you sure you want a meeting with this person?`,
    }],                     
      on: { SPEAK_COMPLETE: "PosNegAnswer" },
},

    Canthear1 : {
    entry: ({context}) =>
    context.ssRef.send({
        type: "SPEAK",
        value: {
            utterance: randomRepeat(dearClient),
        },
    }),
    on: {
        SPEAK_COMPLETE: "#DM.PromptAndAsk.Prompt",
    },

},



//if we dont have high confidence score we go to the state ensure meeting for the creating a meeting. 
    EnsureMeeting:{
        entry: [{
            type: "say",
            params: `Are you sure you want to create a meeting?`,
        }],                     
          on: { SPEAK_COMPLETE: "PosNegAnswer" },
//STOP HERE 
    },

    PosNegAnswer:{
        entry: [{
            type: "listen"
          }],
          on: { ASR_NOINPUT: 
            [{guard: ({context}) => context.reprompt <= 1,
            target: "Canthear1meeting",
            actions: ({context}) => context.reprompt++},
          {guard: ({context}) =>  context.reprompt >2,
          target: "#DM.Done"}],

        RECOGNISED: [
          {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand2"},

            {guard: ({event}) => IsPositive(event.nluValue.entities[0].category),
            target: "#DM.PromptAndAsk.Askwithwhom"},
            {guard: ({event}) => IsNegative(event.nluValue.entities[0].category),
            target: "#DM.PromptAndAsk.Prompt"},
            {guard: ({event}) => helpint(event.nluValue.topIntent),
            actions: [{type: "say", params: `You have to be sure that you want to create a meeting.`}], 
            target: "EnsureMeeting"
        },
        
        ],
        },
    },

    Dontunderstand2: {
      entry: [{
          type: "say",
          params: `I am sorry but I don't understand you. Please tell me something else`,
      }],
      on: { SPEAK_COMPLETE: "PosNegAnswer" },
  },

    Canthear1meeting : {
        entry: ({context}) =>
        context.ssRef.send({
            type: "SPEAK",
            value: {
                utterance: randomRepeat(dearClient),
            },
        }),
        on: {
            SPEAK_COMPLETE: "EnsureMeeting"
        },
    
    },
      
//whoisX STATE

    AskforwhoisX : {
        entry: [{type: "say", params: `Do you want information for a celebrity`}],
        on: {SPEAK_COMPLETE: "LearnWho"}
    },

    LearnWho: {
        entry: [{
            type: "listen"
          }],
          on: { ASR_NOINPUT: 
            [{guard: ({context}) => context.reprompt <= 1,
            target: "Canthear2celebrity",
            actions: ({context}) => context.reprompt++},
          {guard: ({context}) =>  context.reprompt >2,
          target: "#DM.Done"}],
          RECOGNISED: [
            {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand3"},

            {guard: ({event}) => IsPositive(event.nluValue.entities[0].category) && isInGrammar(event.nluValue.entities[0].text),
            target: "Celebrityinfo"},
            {guard: ({event}) => IsPositive(event.nluValue.entities[0].category) && not(isInGrammar(event.nluValue.entities[0].text)),
            target: "DontKnowthisperson"},
            {guard: ({event}) => IsNegative(event.nluValue.entities[0].category),
            target: "#DM.PromptAndAsk.Prompt"},
            {guard: ({event}) => helpint(event.nluValue.topIntent),
            actions: [{type: "say", params: `If you want information for a celebrity you have to say yes and the name of the celebrity, otherwise you should say no`}],
            target: "AskforwhoisX"
        }, 
        ],

    }, },

    Dontunderstand3: {
      entry: [{
          type: "say",
          params: `I am sorry but I don't understand you. Please tell me something else`,
      }],
      on: { SPEAK_COMPLETE: "LearnWho" },
  },

    Canthear2celebrity: {
        entry: ({context}) =>
        context.ssRef.send({
            type: "SPEAK",
            value: {
                utterance: randomRepeat(dearClient),
            },
        }),
        on: {
            SPEAK_COMPLETE: "AskforwhoisX"
        },
    
    },

          DontKnowthisperson:{
            entry: [{
            type: "say",
            params: `I don't know anything for this person. Ask me for someone else`,
        }],                     
          on: { SPEAK_COMPLETE: "#DM.PromptAndAsk.Prompt" },

},  

    

        Celebrityinfo: {
          entry: [{
            type: "say",
            params: ({context}) => `${getInformationCelebrity(context.celebrity)}`
          }],  
          on: { SPEAK_COMPLETE: "#DM.Done" },
          },

//createanappointment STATE

        Askwithwhom: {
          after: {
            "4000": "#DM.PromptAndAsk.Prompt"
          },    
          entry: [{
            type: "say",
            params: `Who are you meeting with?`,
          }],  
          on: { SPEAK_COMPLETE: "Listenwithwhom" },
          },


          Listenwithwhom: {
            entry: [{
                type: "listen"
              }],
              on: { ASR_NOINPUT: 
                [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear3withwhom",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],
              RECOGNISED: [
                {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand4"},

                {guard: ({event}) => event.nluValue.entities[0].length> 0,
                actions: assign({name: ({event}) => event.nluValue.entities[0].text
                }),
                target: "Asktheday"},
                {guard: ({event}) => helpint(event.nluValue.topIntent),
                actions: [{type: "say", params: `You have to inform us about the name of the person you are going to meet with`}],
                target: "#DM.PromptAndAsk.Askwithwhom"
            },
          
            ],
    
        }, },

        
        Dontunderstand4:{
          entry: [{
            type: "say",
            params: `I don't understand you. Please ask me something else`,
          }],                     
          on: { SPEAK_COMPLETE: "Listenwithwhom" },
        },
        
            Canthear3withwhom : {
              entry: ({context}) =>
              context.ssRef.send({
                  type: "SPEAK",
                  value: {
                      utterance: randomRepeat(dearClient),
                  },
              }),
              on: {
                  SPEAK_COMPLETE: "#DM.PromptAndAsk.Askwithwhom"
              },
          
          },
              //function
                
        
        Asktheday: {
          after: {
            "4000": "#DM.PromptAndAsk.Prompt"
          },      
            entry: [{
              type: "say",
              params: `On which day is your meeting?`,
            }],                     
            
            on: { SPEAK_COMPLETE: "ListenTheday" },
          },

          ListenTheday:{
            entry: [{
                type: "listen"
              }],
              on: { ASR_NOINPUT: 
                [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear4day",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],
              RECOGNISED: [
                {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand5"},

                {guard: ({event}) => event.nluValue.entities[0].length> 0,
                actions: assign({day: ({event}) => event.nluValue.entities[0].text
                }),
              target: "Askwholeday",},
                {guard: ({event}) => helpint(event.nluValue.topIntent),
                actions: [{type: "say", params: `If you want to to create a meeting continue with the day of the meeting`}],
                target: "Asktheday"
            },
        
            ],
    
        }, },

        Dontunderstand5:{
          entry: [{
            type: "say",
            params: `I don't understand you. Please ask me something else`,
          }],                     
          on: { SPEAK_COMPLETE: "Listentheday" },
        },



        Canthear4day : {
          entry: ({context}) =>
          context.ssRef.send({
              type: "SPEAK",
              value: {
                  utterance: randomRepeat(dearClient),
              },
          }),
          on: {
              SPEAK_COMPLETE: "#DM.PromptAndAsk.Asktheday"
          },
      
      },
        
          Askwholeday: {
            after: {
              "4000": "#DM.PromptAndAsk.Prompt"
            },
            entry: [{
              type: "say",
              params: `Will it take the whole day?`,
            }],
            on: { SPEAK_COMPLETE: "ListenThewholeday" },
              },


        ListenThewholeday : {
            entry: [{
                type: "listen"
              }],
              on: { ASR_NOINPUT: 
                [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear5wholeday",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],
              RECOGNISED: [
                {guard: ({event}) => event.nluValue.entities.length == 0 ,
                actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                target: "Dontunderstand6"},

                {guard: ({event}) => IsPositive(event.nluValue.entities[0].category),
                target: "Verifyappointment2"},
                {guard: ({event}) => IsNegative(event.nluValue.entities[0].category),
                target: "AskTheTime"},
                {guard: ({event}) => helpint(event.nluValue.topIntent),
                actions: [{type: "say", params: `You have to tell us if your appointment will last for the whole day. If no, you have to continue for the specific time`}],
                target: "Askwholeday"
            },
              
            ],
    
        }, },

        Dontunderstand6:{
          entry: [{
            type: "say",
            params: `I don't understand you. Please ask me something else`,
          }],                     
          on: { SPEAK_COMPLETE: "ListenThewholeday" },
        },
            

      Canthear5wholeday : {
        entry: ({context}) =>
        context.ssRef.send({
            type: "SPEAK",
            value: {
                utterance: randomRepeat(dearClient),
            },
        }),
        on: {
            SPEAK_COMPLETE: "#DM.PromptAndAsk.Askwholeday"
        },
    
    },

        AskTheTime: {
          after: {
            "4000": "#DM.PromptAndAsk.Prompt"
          },
          entry: [{
            type: "say",
            params: `What time is your meeting?`,
          }],   
            on: { SPEAK_COMPLETE: "ListenTheTime"},

          },


          ListenTheTime: {
            entry: [{
                type: "listen"
              }],
              on: { ASR_NOINPUT: 
                [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear5time",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],
              RECOGNISED: [
                {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand7"},

                {guard: ({event}) => event.nluValue.entities[0].length> 0,
                actions: assign({time: ({event}) => event.nluValue.entities[0].text || event.nluValue.utterance
                }),
              target: "Verifyappointment2",},
                {guard: ({event}) => helpint(event.nluValue.topIntent),
                actions: [{type: "say", params: `You have to define the specific time of your meeting.`}],
                target: "AskTheTime"
            },
              
            ],
    
        }, },


        Dontunderstand7:{
          entry: [{
            type: "say",
            params: `I don't understand you. Please ask me something else`,
          }],                     
          on: { SPEAK_COMPLETE: "ListenTheTime" },
        },

    
      
      Canthear5time : {
        entry: ({context}) =>
        context.ssRef.send({
            type: "SPEAK",
            value: {
                utterance: randomRepeat(dearClient),
            },
        }),
        on: {
            SPEAK_COMPLETE: "#DM.PromptAndAsk.AskTheTime"
        },
    
    },
      Verifyappointment1: {
        after: {
          "4000": "#DM.PromptAndAsk.Prompt"
        },
        entry: [{
          type: "say",
          params: ({context}) => `Do you want to create an appointment with ${context.name} on ${context.day}?`,
        }],    
          on: {SPEAK_COMPLETE: "NegPosVerif1"},
        },

        NegPosVerif1: {
            entry: [{
                type: "listen"
              }],
              on: { ASR_NOINPUT: 
                [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear6createappoint1",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],
              RECOGNISED: [
                {guard: ({event}) => event.nluValue.entities.length == 0 ,
                actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                target: "Dontunderstand8"},

                {guard: ({event}) => IsPositive(event.nluValue.entities[0].category),
                target: "CreateAppointment"},
                {guard: ({event}) => IsNegative(event.nluValue.entities[0].category),
                target: "#DM.PromptAndAsk.Askwithwhom"},
                {guard: ({event}) => helpint(event.nluValue.topIntent),
                actions: [{type: "say", params: `You have to say yes or no so you agree or diasagree with the verification of your appointment.`}],
                target: "Verifyappointment1"
            },
          
            ],
    
        }, },

        Dontunderstand8:{
          entry: [{
            type: "say",
            params: `I don't understand you. Please tell me something else`,
          }],                     
          on: { SPEAK_COMPLETE: "NegPosVerif1" },
        },

        Canthear6createappoint1: {
            entry: ({context}) =>
            context.ssRef.send({
                type: "SPEAK",
                value: {
                    utterance: randomRepeat(dearClient),
                },
            }),
            on: {
                SPEAK_COMPLETE: "#DM.PromptAndAsk.Verifyappointment1"
            },
        
        },




        Verifyappointment2: {
          after: {
            "4000": "#DM.PromptAndAsk.Prompt"
          },
          entry: [{
            type: "say",
            params: ({context}) =>`Do you want to create an appointment with ${context.name} on ${context.day} at ${context.time}?`,
          }],    
            on: {SPEAK_COMPLETE: "NegPosVerif2"},
          },



          NegPosVerif2: {
            entry: [{
                type: "listen"
              }],
              on: { ASR_NOINPUT: 
                [{guard: ({context}) => context.reprompt <= 1,
                target: "Canthear7createappoint2",
                actions: ({context}) => context.reprompt++},
              {guard: ({context}) =>  context.reprompt >2,
              target: "#DM.Done"}],
              RECOGNISED: [
                {guard: ({event}) => event.nluValue.entities.length == 0 ,
                            actions: ({event}) => console.log(event.nluValue.entities, event.nluValue.entities.length),
                            target: "Dontunderstand9"},

                {guard: ({event}) => IsPositive(event.nluValue.entities[0].category),
                target: "CreateAppointment"},
                {guard: ({event}) => IsNegative(event.nluValue.entities[0].category),
                target: "#DM.PromptAndAsk.Askwithwhom"},
                {guard: ({event}) => helpint(event.nluValue.topIntent),
                actions: [{type: "say", params:  `You have to say yes or no so you agree or diasagree with the verification of your appointment.`}],
                target: "Verifyappointment2"
            },
            
            ],
    
        }, },

        Dontunderstand9:{
          entry: [{
            type: "say",
            params: `I don't understand you. Please ask me something else`,
          }],                     
          on: { SPEAK_COMPLETE: "NegPosVerif2" },
        },

        Canthear7createappoint2:  {
            entry: ({context}) =>
            context.ssRef.send({
                type: "SPEAK",
                value: {
                    utterance: randomRepeat(dearClient),
                },
            }),
            on: {
                SPEAK_COMPLETE: "#DM.PromptAndAsk.Verifyappointment2"
            },
        
        },
        
        
        CreateAppointment:{
          entry: [{
            type: "say",
            params: `Your appointment has been created.`,
        }],   
                
          on: {SPEAK_COMPLETE: "#DM.Done"},
          },},},
          Done:{
            on:{
              CLICK : "PromptAndAsk"
            },
          },
        },});
            


const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.log(state)
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
