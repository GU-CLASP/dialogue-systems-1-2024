import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";
import { NLU_KEY } from "./azure.js";


const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://lab4-lg-resource.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY /** reference to your Azure CLU key */,
  deploymentName: "Appointment0" /** your Azure CLU deployment */,
  projectName: "AppointmentLab4" /** your Azure CLU project name */,
};

const settings = {
  azureLanguageCredentials: azureLanguageCredentials,
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

/* Grammar definition */
const grammar = {
  // vlad: { person: "Vladislav Maraev" },
  // aya: { person: "Nayat Astaiza Soriano" },
  // rasmus: { person: "Rasmus Blanck" },
  // staffan: { person: "Staffan Larsson" },
  // chris: { person: "Christine Howes" },
  // monday: { day: "Monday" },
  // tuesday: { day: "Tuesday" },
  // wednesday: { day: "Wednesday" },
  // thursday: { day: "Thursday" },
  // friday: { day: "Friday" },
  // "8": { time: "8:00" },
  // "9": { time: "9:00" },
  // "10": { time: "10:00" },
  // "11": { time: "11:00" },
  // "12": { time: "12:00" },
  // "noon": { time: "12 pm" },
  // "1": { time: "1 pm" },
  // "2": { time: "2 pm" },
  // "3": { time: "3 pm" },
  // "4": { time: "4 pm" },
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
      }),

    nluListen : ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
        value: { nlu: true } /** Local activation of NLU */,
      }),  
  },

}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwBWAMwBGRVsUaALADYTAdhOKANCACeiHTvPoNKlfq4muixUY0AvgG2aOgA6gTi1ILkYkRixADCADIAkokA0tx8SCBCohLSsgoIGoo66DqaigAc5npGOlratg4IThVcNVo9RjUqphoaJkEhGBFRMXHYCXKwcWJg6AQAZovYABQ67lwAlMShE2LRsfHZsvnikjK5JWUVVWV1DU0t9o4mFRrdPYpWGjozJpRiBQjhBABbPBiUhSCCkWAAazIVHoADkAPKpNGYACq1HOuUuhRuoBK23MrSUNW66BqjXKNUZny0RhBYOwkOhsPhSJRlHRWJx+I4OhyAmEVyKtyURnKdOaNTUijUNJ6Gip7XM2kqWn6Xh6ejU5jZwVBGHBUJhcIRiKwnKtxHImBYGXoiQxqEwySY1CYhIlBWuxVlRnQJj6Rl+XC0XFMqs1ZS0rh+im1aZpn3ZFod3JtSPQAHEwGJUlJFuX0LayxWEs7Xe7Pd7ff7eBdJSSQwgDGpw5GrDHLF4TFpNb56q4jaqfOYmTVs-audbeXbi6Xy2BK8kRPNNwAxQTYGubhLMD2FtGpchMZABvId4MyhAmmroOMmOpDHTfAE6TXOFR0EaHR-HpGkuHMNQF0tPMVyLEtjy3HcKwPI8N3LYgzwxC8rxvUVxXvINpTJRBtVfd9PwBH8nDHFVFDpOo1CY0xIxA6Dc2XW14PXWt0G3XcpFQxDTyYc9L2vW9FAI4lHxI59vjfUxKO-Gpf3-ZVXz1SC1AsEw1C6EYzQ5JceS4sIAAtBFSWAAA0qwAI0EABXMQbKdF1SDdD0vR9P07xk4j5FleVum+ZVVR+DV3nafpkxHfpDFnKodG6diTPzO1hMSaQVic0RpHQYS0UEMRKDAABjQQoCkHdIHchtvObPy2yJB9ApKPwQsVcK1WadSP3DLRtJ0qMnDlNKrVMgtbUwMBsFgArbQswR6s8xsfJbfy2tJIL2j8DQUzCjpWWNGox2aOK9RUcwht8CkJtgriZrmhapD45DN2WzDROw8S8JawMpR2koX0Uj9tSo1SaOivwzF1foqmNb8jCgoyc3SuDnvmgr+IrL6sJwiT8PbIjgY+RpXAgpkVRNQFAXOrRez1fUIxA5QmgeziC2KmEADdIgAGwIeyBbAVavKbXzW2k7au22Kx1CGvoLH8Lh5bHECKmZjwAXqRpDLGRdJoy7jkAIOwqyRCyRHK8yzbscX1qa6WSaBrtY3oxn6UaVUzDjGxorG1Q5R0-TtRjYE0aNx6CzXe33oE63bYgc3vrE3DbwBwi3afMj0BuqN+nuNWNEpQPtjDGMI2GbQvC4VHDZgrnVxLePcc+8ybfMlOHYJv7bzFV3OyfD30C9owfZqP25X-ONk2NExhj0ienGaTmppbsR46WyzRftx3GqlrbSa7KeXAjrxan8QEAU1TRz5+OVtiZMxFHXk24-NhO8d3sB977jOx8c5yQAsmWoeh9BMRLnUTU3QTBjx6KyD8Hg15RybhvU2X925SGWnvVOACiaD1aifXOCkC5XWLt+MubQ9BOHhjOKMukuCBDQRxDBn8LbYNwX-fBP1CZ4SkkPWSu087kKLuUEu1DHDXRTIgtMfgDCWHfnBDhltETUBEBCMW9Y1qH02lnAKZM9qskqPUVSOkDDdBgYHccb5jB6TcJ8RhppG5sI-q3LBH0pAaK0WnX6gCDGyyfKA9A4DfCM30ipKR7QqiqDMCBbw9Ib7KK4qo7BPixYELwkQwGw8QH6DDM4FKGgLG1C0v+JocTJF6C-MYecrCMZcUSLgAgixuH21IHgaEB9Jb6JliQuS5RvChJRiNLovwoptDgQg3oyCfAXRSQWZpYBWlgAyZ07pOiJYbWav04Bu1ygqjpFGeo+khpq30P+col0Eomi0Ew8wiy7TYI2WIbKUgVgiGwBCPx-DM57LyQcp+Cowoql6pMpQ3hexT0GIzT4XQG7mmjs3b+m5XnvM+d835-dibEP2SDPoYNlLUT-DDVkyZtYpTUMjEcTzUVSHRTlL5PysmSQBcIkGCkKIQxUmpGG2pkwlNod8CM+gFzIGkGLFI6QsiBIGbtMompdAQSAsaa+jNzD12NEEM0UhBAQDgLINAQj2qIAALQmE1Ba9i+AiBgBNUYme0UahfB2FUF1cZAQGyRUcE40wxAOvdi6kZ5RlRDTUP4Uc5cXBMVjXUNWmq-D1NcY0pEganymE1I0ZM4zfhez0JYFhKbjZwU7vMdNICYz0SZDGeuKhGY3zHNSiodRLBKm-GmLQdKm4Vt2saRMgFviIJOdSvSXaGkltSQhdCAa8WAvJKyDWnw3yVJ8EqfoY66VrmEmo4SvbyRMlooSgEsY4yMQ6Fu6dvFsFCRnfuxA2gKgFJ9uYV9zhF5HtfCegY56nB0uWtZGy96EAL3DKc4wyMdJnUDovZMTQErDBSi6qe-7LKAYcs5VywHth+DA48RoxgoP-hNHEq6aYSm+x8HSrKOU8rCMMXLNWYYa2GCaKySCJp-yqVfPBgYJ7mjDGozOjFdGCpFRKmVSq1VaoQGw5fOkyhWO9A40YdS-hBosxRlGJGdKsavTkyjRWL4VZuHVjDBR9CIFyn8IYXTSJZrYzejvQQcnjRGeViaUzXgGakYRnKApEa7OIgc69ely1sMTxcEUsCqlYwWGg20fQsYNNMfCVpulPNSD8xEELEW9q50cscKO0JLrDARisOOAOiXR5I1ZMMIwXR66Xq3ubYDEbYF6VkayC55hfCmGa9vK2ndbb2wi1Vxw2wviVO-EMY0d0BueMTsN7urWCumtKK+0xKVtRGBNECaJTg4wrtjDNkpvXygLYts5vBbRcmFfaFTcMfgmLOFM+mWeTIUua3HF0N+E6Y6bzbl49pq27vrdLvRaLO29t6WiUxc+9d23OCns0FxSL0HuJa1dpEGS5P9FcBDl12hF4o4qTSSzqpNWWHuZd+luO1tGO-F0dQNm1C6GUPpCeFT9JfcpxBEc3rjKTqWS0tpv8OldNnWDxnEbez6SsHTQwJSPywKaDMnoYa5R6iLejtxcFlmrPWZL7Dmh4H3PqJ8NwcZjDc982rPn1PEVC4B-SxlHzmXYYMGOG6kPlSvrqyOFU4rJXAbTEdhrVgUZdHMaSmhOl4HxWYTdCB6odUBCAA */
  context: {
    noInputCount: 0,
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
        ASR_NOINPUT: [{
          target: "PromptAndAsk.hist",
          guard: ({ context }) => context.noInputCount < 4,
          actions: [ assign(({ context }) => {
            return {
              noInputCount: context.noInputCount + 1,
            };
          }), {
            type: "say",
            params: "I didn't hear you",
          }]
        }, { target: "#DM.Done" 
      }]
    },
      
      states: {
        hist: {
          type: "history",
        },

        Prompt: {
          entry: [{
            type: "say",
            params: `Hello!`,
          }],
          on: { SPEAK_COMPLETE: "GetIntent" },
        },
        GetIntent: {
          initial: "AskIntent",
          states: {

            AskIntent: {
              entry: [{
                type: "say",
                params:`How can I help you?`,
              }],
              on: { SPEAK_COMPLETE: "ListenForIntent" },
            },

            //check for intent here??:   how.
            ListenForIntent: {
              entry: "nluListen",
                on: {
                  RECOGNISED: [{ //for appointment

          // can acces entities and intents from event directly!
          // go for topintent (is own array element)
          // entities will just give you an array

                    guard: { // for Who is X intent
                      WhoIsXIntent: ({ context, event }) => {
                        return event.topintent == "Who Is X" //access topintent here
                      },
                    }, //intent is who is X -> go to info 
                    target: "#DM.PromptAndAsk.WhoIsX", // who is X branch
                    actions: assign({
                      who: ({ event }) => getPerson(event.value[0].utterance),
                    }),                      // still assign who
                  }, {
                    guard: { // for meeting intent
                      MeetingIntent: ({ context, event }) => {
                        return event.topintent == "Create a meeting"
                      },
                    },
                    target: "#DM.PromptAndAsk.AskPerson",
                    // check for entities in utterance, assign those ggf
                    // maybe do this as initial check in AskPerson or sth?
                    // idk if the event transfers post transition
                  }, {
                    // default: for intent is unclear
                    target: "#DM.PromptAndAsk.IntentConfusion",
                  }],
                },
              },
            },
          },

        WhoIsX: {
          initial: "AboutX",
          states: {
            AboutX: {
              entry:  [{
                type: "say",
                params:``, //how to get Info from NLU
              }],
              on: { SPEAK_COMPLETE: "#DM.Done"},
            },
          },
        },
    // next tue
        IntentConfusion: {
          initial: "IntentNotRecognised",
          states: {
            IntentNotRecognised: {
              entry:[{
                type: "say",
                params: ({ context }) => { 
                  return `Sorry, I'm unsure what you want to do. You can
                  book an appointment or ask about a famous person.`;
                },
              }],
              on: { SPEAK_COMPLETE: "#DM.Done" },
            },
          },
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
                  target: "#DM.PromptAndAsk.NotAvailable",
                }],
              }},

            },
          },

          NotAvailable: { //later: make sure it asks who to meet with again?
            entry: [{
              type: "notInGrammar",
              params: "not available",
            }],
            on : { SPEAK_COMPLETE: "AskPerson" }
          },
          
          


       //// 
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
},
);

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
