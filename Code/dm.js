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
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: {day: "Wednesday"},
  Thursday: {day: "Thursday"},
  Friday: {day:"Friday"},
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  yes: {response: "yes"},
  no: {response:"no"},
  ofcourse: {response:"of course"}
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
  //this gives back the nickname, key returns a boolean
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
  //this gives back the full name, value of the value 

  //functions for .date, .time
}
function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day;
}
function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}


const dmMachine = setup({
  actions: {
    /* define your actions here */
    
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwA2RQFYuAdi4AOACzaDexQBoQAT0QBGe3vTa1btduMBmRXrXGnAF9A6zR0AHUCcWpBcjEiMWIAYQAZAEkkgGluPiQQIVEJaVkFBHtNdV0VXzUuRWN66zsEbUNFdA1jdw1tLydPQ2DQjBxBAFs8MVIpCFJYAGssbHHJ4nJMFkz6JIB5VEwUpmomHNkC8UkZPNKur3R7Qz1tey4nYw03JsQew3RjFRUTkM2h6ZiGIDCowmUxmc0WcOIzF2AHEAHJpchMZCnPLnIpXUClD7adCPXSKXzAvRePxfFpddB+breRwWcGQ5bQ6azBboBHrTbbPYHI4nXhnYQXYrXBx6DToZQArxcNzGALaOkBO6ubqKZUqDRebTsjDIaRgZLpLI4gSS-ElWXyxUqZWq9V03rtfzdLzK1pqezBEIgKSCCBwWRoCWFS4OhAAWg0dPjJPcbkMbUMGnsvpNS3wRDA0alBPkiAadMM9gVaeMhi8Gj0xj0ekDwbCkWisXi2DExftMpaeg9bUZXTcH3KDy6eahk25cP7scHiizCp0LpVr1Xvk1Wj+7izekeXB6xlnnPnsN5c77uLty8JiF9xnXVVd27aw9s3yN9wBKhuP6DQXisMI8vCCxLtKT4IB8dyaDo9iNi8FhGHSPSqPYVTbmoiiNmC7amua0GlqU2hWD+CABGoCr1j4ajAs8nhBoEQA */
  context: {
    count: 0,
    MeetingWithwhom: '',
    Dayofmeeting: '',
    Timeofmeeting: '',
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
      on: {
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Let's create an appointment`,
              }
              }),
            },
          on: { SPEAK_COMPLETE: "Askwithwhom" } 
        },
        Askwithwhom: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Who are you meeting with?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Asktheday" },
          },
          Listenwithwhom: {
            entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: {
              RECOGNISED: [
            {
              guard: ({context}) => isInGrammar(context.result[0].utterance),
              target: "Asktheday"
              actions: assign({
                MeetingWithwhom: ({context}) => getPerson(context.result[0].utterance)
              }),  //function
              
            },
            {target : "Done"},
              ],
            },
            },
        Asktheday: {
          entry: ({ context }) =>
              context.ssRef.send({
                type: "SPEAK",
                value: {
                  utterance: `On which day is your meeting?`,
                },
              }),
            on: { SPEAK_COMPLETE: "Askwholeday" },
          },
          ListenTheday: {
            entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: { 
              RECOGNISED:[
            {
              guard: ({context}) => isInGrammar(context.result[0].utterance),//get//({context}) => context.result[0]utterance === 'maria', FUNCTION WHOLE DAY
              target: "Askwholeday", 
              actions: assign({
                Dayofmeeting: ({context}) => getDay(context.result[0].utterance)
            }),
              
          },
          {target : "Done"},
            ],
          },
        },
        
          Askwholeday: {
          entry: ({ context }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `Will it take the whole day?`,
                  },
                }),
            on: { RECOGNISED: "AskTheTime" },
              },

              ListenThewholeday:{
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: { 
              RECOGNISED:[
            {
              guard: ({context}) => isInGrammar(context.result[0].utterance),//get//({context}) => context.result[0]utterance === 'maria', FUNCTION WHOLE DAY
              target: "Verifyappointment", 
              actions: assign({
                Dayofmeeting: ({context}) => getTime(context.result[0].utterance)
            }),
          },
          {target : "Done"},
          ],
        },
              },

              }
        AskTheTime: {
          entry: ({ context }) =>
              context.ssRef.send({
                  type: "SPEAK",
                  value: {
                  utterance: `What time is your meeting?`,
                      },
                    }),
            on: { SPEAK_COMPLETE: "Verifyappointment"},

          },

          ListenThetime: {
            entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: { 
              RECOGNISED:[
            {
              guard: ({context}) => isInGrammar(context.result[0].utterance),//get//({context}) => context.result[0]utterance === 'maria', FUNCTION WHOLE DAY
              target: "Verifyappointment", 
              actions: assign({
                Dayofmeeting: ({context}) => getTime(context.result[0].utterance)
            }),
          },
          {target : "Done"},
          ],
        },
      },
        Verifyappointment: {
          entry: ({ context }) =>
              context.ssRef.send({
                type: "SPEAK",
                value: {
                    utterance: `Do you want to create an appointment with ${getPerson(context.MeetingWithwhom)} on ${context.Dayofmeeting} at ${context.Timeofmeeting}?`
                      },
                    }),
            on: {RECOGNISED: "NegPosVerif"},
          },
        NegPosVerif: {
            on: {
              "yes" : "CreateAppointment",
              "no" : "Prompt",
          }
        },
        CreateAppointment:{
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Your appointment has been created.`,
                },
              }),
          on: {SPEAK_COMPLETE: "Done"},
          },
          Done:{
            on:{
              CLICK : "Prompt"
            },
          },

        },
      },
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

