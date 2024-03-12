import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings = {
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

/* Grammar definition */
const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  staffan: { person: "Staffan Larsson" },
  chris: { person: "Christine Howes" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  "8": { time: "8:00" },
  "9": { time: "9:00" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "noon": { time: "12 pm" },
  "1": { time: "1 pm" },
  "2": { time: "2 pm" },
  "3": { time: "3 pm" },
  "4": { time: "4 pm" },
};

const confirm = {
  yes: { bool: true },
  sure: { bool: true },
  "of course": { bool: true },
  right: { bool: true },
  yup: { bool: true },
  yep: { bool: true },
  ja: { bool: true },
  yea: { bool: true },
  yeah: { bool: true },
  no: { bool: false},
  nope: { bool: false},
  nah: { bool: false},
  "no way": { bool: false},
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}

function asBoolean(utterance) {
  return (confirm[utterance.toLowerCase()] || {}).bool;
}

function hasBoolean(utterance) {
  return utterance.toLowerCase() in confirm;

}

const dmMachine = setup({
  guards: { //somehow pass last utterance value, store in context.input?; always updated
    isPerson: ({ event }) => {
      return (isInGrammar(event.value[0].utterance) && getPerson(event.value[0].utterance));
    },

    isDay: ({ event }) => {
      //return true;
      return (isInGrammar(event.value[0].utterance) && (grammar[event.value[0].utterance.toLowerCase()] || {}).day);
    },

    isTime: ({ event }) => {
      //return true;
      return (isInGrammar(event.value[0].utterance) && (grammar[event.value[0].utterance.toLowerCase()] || {}).time);
    },

    isNegation: ({ event }) => {
      return hasBoolean(event.value[0].utterance);
    },
  },

  actions: {
        /* define your actions here */
    notInGrammar: ({ context, event }, params) => 
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `Sorry, ${
            event.value[0].utterance
          } is ${ params }.`,
        },
      }),

    listen: ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
      }),

    say: ({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
        },
      }),    
  },

}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwBWAMwBGNV23auANjVaANCACeiAOwAOY+mO2ALBvu6zrxboC+fpZo6ADqBOLUguRiRGLEAMIAMgCS8QDS3HxIIEKiEtKyCggaijroehquPsZaxvZctraWNggOqooatpqNriqdAUEYYRFRMdhxcrAxYmDoBABmM9gAFDoqKgCUxMHDYpHRsZmyueKSMtlFJWUVVYo1dQ1N1oieqrad+u9aWo9qAyDBHCCAC2eDEpCkEFIsAA1mQqPQAHIAeWSiMwAFVqEdsid8udQEUHuhbMYNDUtMoNJ1FPZmi9viT7Dpaj53lUtH9AgCMEDQeDIdCYVhsCCwcRyJgWGl6PFkahMIkmNQmDiBMJTgULi9XPZ0K4dD5vvZPIozTp6QgdIouup7O4fi4uI41K5-oDRfyIVDYeghZgwNhYNI-bCQgALQQSqWkGVyhVKlVqnIa-GFRAs1xOLhmxTuSqu7yWw2KNTley2LSGLSuNQdd28z1g71C0MwgNBkOJERTMBSCNR5hygDiiOS5CYyGTeLO6YQpjeZIpVJpdOeVo0ZXWXBZxhzJi0jgbIrFAp9wv9geDUnQ3d7-cjxCHyNH48nHB0WXVeVn2qtNezXN81rWsa2Lb5FBJGsqzqXw1HsLlBhPL1BV9YcwDEZACCsNsIxEABjcMsKsaNpVleVFWVVVeGOVNf0JF5HHKYxejzQ0qh0a1LRYvUGlLV46mZNQdGPPlm1Q4V0Mw7Dbx7GYHwI8MIGwp8mBHMcJynGjcTorUGP-Hx9TUYzbF8Vwa3cbjOOcLpK2MXxSW0WxRKbM9Wyk4jZPvPDCOUkjn1fTSPy-FMfz0+RGKcHQWJzA0qgNLj12pMpjD0Tx7GpSkyRc08WzQjDPKFAcABswGI0jY3IhMqOnXSCQiq13FUeoszrOtWIsdcs1cEk7g0OtjD3CsbWc7kPVyiT0A8mS73kkqypUgKNPfbTv01eqijNCt0C4LMMptLRSTJS1oPURyzBZHN+q0HKUPPKaCpmuS+3m8qlrfKdP1osKNozGtINrEyzIsjRLVsHQ9QcTM80pewOkUW7xPu6acNml7I1Kt61JfZap0UEKZ3CopoaMoHoKqUGkp0DR0DNMlhNM5RjOMRG3Py6ScKFagRGBMAKrjCjE2ogm6rnCGdFsdRDsBvc7irNQwZrZx4J3Mlajh0akLEtnJMe1HnqkbnedU9SPtqn65y2yXdrqEpKyOymWlMPUflcUk1FsAxBui1m8t1jmvPko2+feoKvp0i2-3FyWzDcZmcxqfruMPWmqmGnNrVM+xfcm+JcAIGZXuw0g8HFSUyPjSik1W0L1sttwep3DwyUNcHDRO8yzvp3Qfg6V0c-uvOwALsBg5LsuYwF6rq5FyP9JtFlnC4TQPdMWkK06lpTLKWld09wa608AfWzRqRx7EeJpHmERsGBE2cbNmvCd+-8yxzKtqYlt3HG+YsXD1CGlYIbKDuNFFmY1GwTXuqfc+l8pDX1vvfQK75w5rTTH+DKWh9SeD0MZD2zpl7gR+NgnwnhORrEGuArWrk-aBz7LAq+N876h3fPjb6dc-ymUXOSCCBhVzFg4rTf6pJHBHUQjydAyBpB8ySKkDIT9RZR05DtXwm5NxuAcPZJ4LQKx6g6F0aKfVqZH3+FIQQEA4CyDQOw9B+kAC0xhLR2N8OoPBbj3HOhcvgIgYAbH0Qaj4MGGhVAuCzHcTQuhBoaGPLsfYYwxB+KJogQ8O8jSHjJPbYSjs7DbS-h4Lw-1-AQOQkjIUiSX72TLI5ZcfCs7J3QME9YDw1heGzsU7WtDwxyXKXOe0ZZAb6AQp4T2bhLQZWzA0fQvR6ge0qMfX02semcJUCSJcvDqR1PXNackdo06Ukyu8eZF5YQdmvEs-SnF3DoEOoeA0rosx1AtFsvMNMzLuE0GaLoCN2k0MmpeTsN4iqRnOQ1TiZhrmVntHoKog1mTgSzOUG0wTTDgwdG6H5UDWz-OvHQh8ggQXE3sm8TQtZyQlFrDmeFeotHIo9oabQ6LqGYvZsRAliAXCS2qes-h65DqSzph4QV8FpmMokR0yaKNcJdMIqyiOHD9KmRplyyktTaTcWXuUcktJUqeB8HMjFd13J61xT5JS2E2VWmiqoWObsWQgMpFZFKWrHAQ3+toI5D0A5AsEJjc1crbGgsGpBTkJgSzCS4JSTeiB+rtGZEinMbgtoeslafIuLQ0H+OJtTGmNrwYqt8IoS0wSepqxZFwyontvjJuNVzHmvj-WZozINHqlJSxVlISaLM3FNBMhZHoFu5kazVoDqfYOFqmaQXBsvLMjR7Tkm0ey+CtNmReAHd8UV41DW+iHiPNN59x3aCwS4CGmh6ggKeS0FVXdUpqFSiModBrSnbvzjMMepcEkNqSQgDovRyiw1LF0EozJXDdr0Suuowlb2cm+UyrdwoYHvrgQg4EFrwZlkGjmUosNjQXozJUSCdRTKVk6I4Phx4pFSHrRmr9gT1wmicFCtivgTA6oCAEIAA */
  context: {
    count: 0,
    who: '',
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
        10000:  "PromptAndAsk",
      },
      on: {
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "Prompt",
      on: {
        ASR_NOINPUT: {
          target: "PromptAndAsk.hist",
          actions: [{
            type: "say",
            params: "I didn't hear you",
          }],  
      }},
      
      states: {
        hist: {
          // I tried different positions for the hist state; here on PromptAndAsk as well as on
          // DM, with both deep/shallow and reenter true/false. My only results were no transition,
          // or transitions to AskWho. Additonally, I experimented with the placement and reenter conditions
          // on ASR_NOINPUT, but to no avail.
          type: "history", //why does it keeo going to AskWho?
          history: "deep",
          reenter: true,
        },
        Prompt: {
          entry: [{
            type: "say",
            params: `Let's create an appointment!`,
          }],
          on: { SPEAK_COMPLETE: "AskPerson" },
        },
        AskPerson: {
          initial: "AskWho",
          states: {
            AskWho: {
              entry: [{
                type: "say",
                params:`Who are you meeting with?`,
              }],
              on: { SPEAK_COMPLETE: "ListenWho" },
            },
            ListenWho: {
              entry: "listen",
              on: {
                RECOGNISED: [{
                  guard: "isPerson",
                  target: "#DM.PromptAndAsk.GetDay",
                  actions: assign ({
                    who: ({ event }) => getPerson(event.value[0].utterance)
                  }),
                }, {
                  target: "AskWho", //later: make sure it asks who to meet with again?
                  actions: [{
                    type: "notInGrammar",
                    params: "not available",
                  }],
                  reenter: true, // no effect?
                }],
              },
            },
          },
        },
        GetDay: {
          initial: "AskWhichDay",
          states: {
            AskWhichDay: {
              entry: [{
                type: "say",
                params: ({ context }) => { 
                  return `Meeting with ${ context.who } on which day?`;
                },
              }],
              on: { SPEAK_COMPLETE: "ListenWhichday" },
            },
            ListenWhichday: {
              entry: "listen",
              on: {
                RECOGNISED: [{
                  guard: "isDay",
                  target: "AskWholeDay",
                  actions: assign ({
                    day: ({ event }) => event.value[0].utterance,
                  }),
                }, {
                  target: "AskWhichDay", //re-raise?
                  actions:[{
                    type: "notInGrammar",
                    params: "not a valid day",
                  }],
                }],
              },
            },
            AskWholeDay: {
              entry: [{
                type: "say",
                params: ({ context }) => { 
                  return `Will the meeting on ${ 
                    context.day
                  } take the whole day?`;
                },
              }],
              on: { SPEAK_COMPLETE: "ListenWholeDay" },
            },
            ListenWholeDay: {
              entry: "listen",
              on: {
                RECOGNISED: [{
                  guard: ({ event }) => asBoolean(event.value[0].utterance),
                  target: "#DM.PromptAndAsk.CreateWholeDayAppt",
                }, {
                  guard: "isNegation",
                  target: "AskTime",
                }, {
                  target: "AskWholeDay", //re-raise?
                  actions:[{
                    type: "notInGrammar",
                    params: "not a clear confirmation nor negation",
                  }],
                }],
              },
            },
            AskTime: {
              entry: [{
                type: "say",
                params: `What time would you like to meet ?`,   
              }],
                on: { SPEAK_COMPLETE: "ListenTime" },
            },    
            ListenTime: {
              entry: "listen",
              on: {
                RECOGNISED: [{
                  guard: "isTime",
                  target: "#DM.PromptAndAsk.CreateTimeAppt",
                  actions: assign ({
                    time: ({ event }) => getTime(event.value[0].utterance),
                  }),
                }, {
                  target: "AskTime", // re-raise?
                  actions: [{
                    type: "notInGrammar",
                    params: "not an available timeslot",
                  }],
                }],
              },
            },
          },
        },
        CreateWholeDayAppt: {
          entry: [{
            type: "say",
            params: ({ context }) => { 
              return `Do you want me to create an appointment with ${
                context.who
              } on ${
                context.day
              } for the whole day?`;
            },
          }],
            on: { SPEAK_COMPLETE: "ListenApptConfirm" },
        },
        CreateTimeAppt: {
          entry: [{
            type: "say",
            params: ({ context }) => { 
              return `Would you like to create an appointment with ${
                context.who
              } on ${
                context.day
              } at ${
                context.time
              } ?`;
            },
          }],
            on: { SPEAK_COMPLETE: "ListenApptConfirm" }
        },
        ListenApptConfirm: {
          entry: "listen",
          on: { 
            RECOGNISED: [{
              guard: ({ event }) => asBoolean(event.value[0].utterance),
              target: "#DM.Done",
              actions: [{
                type: "say",
                params: `Thank you, your appointment has been created!`
                }],
            }, {
              guard: "isNegation",
              target: "#DM.PromptAndAsk.AskPerson",
              reenter: true,
            }, {
              target: "#DM.PromptAndAsk.hist",
              reenter: true,
              actions: [{
                type: "notInGrammar",
                params: "not a clear confirmation nor negation",
              }]
            }],
          },
        },
      },
    },
    Done: {
      on: {
        CLICK: "PromptAndAsk",
      }
    }
  }
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  /* if you want to log some parts of the state */
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
