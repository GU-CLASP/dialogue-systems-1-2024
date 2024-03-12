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

/*I'm using this version of the grammar where the outer keys are the categories and inner keys are the possible utterances.
Even though I removed the original grammar, I named this one grammar2 just to highlight that it is different, 
in case it otherwise would raise any questions when I'm accessing the grammar in a way that wouldn't work
for the original setup*/

const grammar2 = {
  people: { vlad: "Vladislav Maraev", aya: "Nayat Astaiza Soriano", rasmus: "Rasmus Blanck", santa: "Santa Claus" },
  days: { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",},
  times: { "7": "7:00", "8": "8:00", "9": "9:00", "10": "10:00", "11": "11:00", "12": "12:00", "13": "13:00", "14": "14:00", "15": "15:00", "16": "16:00", "midnight": "00:00"},
  affirmative: { yes: "Yes", "of course": "Of course", "that's right": "That's right" },
  negative: { no: "No", "no way": "No way", nope: "Nope", "it will not": "It will not" }
};


function isInGrammar2(utterance, category) {
  return utterance.toLowerCase() in grammar2[category];
}

const dmMachine = setup({
  actions: {
      speak: ({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `${params}`,
        },
      }),
      listen: ({ context } ) =>
      context.ssRef.send({
        type: "LISTEN",
      }),
  },
}).createMachine({
  context: {
    test: `testing` 
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
        CLICK: "InitialiseAppointment",
      },
      after: {
        10000: "InitialiseAppointment"
      },
    },

    InitialiseAppointment: {
      entry: {        
          type: "speak",
          params: `Let's book an appointment!`
        },
        on: {
          SPEAK_COMPLETE: "MeetWho",
          CLICK: "WaitToStart",
        },
    },

    MeetWho: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `Who are you meeting with?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: {type: "listen"},

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => isInGrammar2(event.value[0].utterance, "people"),
                target: "#DM.WhichDay",
                actions: assign({
                  person: ({ event }) => grammar2.people[event.value[0].utterance.toLowerCase()],
                }),
              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.MeetWho" },
        },
      },
    },

    WhichDay: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `On which day is your meeting?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: {type: "listen"},

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => isInGrammar2(event.value[0].utterance, "days"),
                target: "#DM.WholeDay",
                actions: assign({
                  day: ({ event }) => grammar2.days[event.value[0].utterance.toLowerCase()],
                }),              
              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.WhichDay" },
        },
      },
    },

    WholeDay: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `Will it take the whole day?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: {type: "listen"},

          on: {
            RECOGNISED: [
              /*this guard and directing to another state seems very clumsy, but I didn't find a way to combine
                one guarded transition (if utterance is in "affirmative"), followed by another (if in "negative"),
                followed by a third (if it's in neither). I found only a way to have one guarded transition followed
                by an alternative transition (which is enough in other states)*/
              {
                guard: ({ event }) => isInGrammar2(event.value[0].utterance, "affirmative") || isInGrammar2(event.value[0].utterance, "negative"),
                target: "YesNoDisambig",
                actions: [
                  assign({
                  wholeday: ({ event }) => event.value[0].utterance,
                }),
                ({ context }) => {console.log(context.wholeday, isInGrammar2(context.wholeday, "affirmative"))},
                ],
                
              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        
        YesNoDisambig: {
          always: [{
            guard: ({ context }) => isInGrammar2(context.wholeday, "affirmative"),
            target: "#DM.AppointmentCreation",
            actions: ({ context }) => {
              console.log(context.wholeday)
            },
          },
          {target: "#DM.TimeOfDay"},
        ],
        },

        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.WholeDay" },
        },
      },
    },
    
    TimeOfDay: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `What time is your meeting?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: {type: "listen"},

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => isInGrammar2(event.value[0].utterance, "times"),
                target: "#DM.AppointmentCreation",
                actions: assign({
                  time: ({ event }) => grammar2.times[event.value[0].utterance.toLowerCase()],
                })
              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.TimeOfDay" },
        },
      },
    },

    AppointmentCreation: {
      initial: "WholeDayDisambig",  
      states: {
        WholeDayDisambig: {
          always: [{
            guard: ({ context }) => isInGrammar2(context.wholeday, "affirmative"),
            target: "PromptingWholeDay",
          },
          {target: "PromptingPartialDay"},
        ],
        },
        PromptingWholeDay:{
          /* Can only access the context for speaking using the speechstate SPEAK action. My defined speak action does not work*/ 
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Do you want me to create an appointment with ${context.person} on ${context.day}
                for the whole day?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Listening" },

        },
        PromptingPartialDay: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Do you want me to create an appointment with ${context.person} on ${context.day}
                at ${context.time}?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Listening" },
        },
        Listening: {
          entry: {type: "listen"},

          on: {
            RECOGNISED: [//again, this seems a clumsy solution
              {
                guard: ({ event }) => isInGrammar2(event.value[0].utterance, "affirmative") || isInGrammar2(event.value[0].utterance, "negative"),
                target: "YesNoDisambig",
                actions: 
                  assign({
                  book: ({ event }) => event.value[0].utterance,
                }),               
                
              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },

          YesNoDisambig: {
            always: [{
              guard: ({ context }) => isInGrammar2(context.book, "affirmative"),
              target: "#DM.Final",
              actions: {
                type: "speak",
                params: `Your appointment has been created! Click again to book another one.`
              },
            },
            {target: "#DM.InitialiseAppointment",
          actions: {
            type: "speak",
            params: `All right! Let's try again.`
          }},
         ],
        },

        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.AppointmentCreation" },
        },
      },
    },
    Final: {
      on: {
        CLICK: "InitialiseAppointment",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();


export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
