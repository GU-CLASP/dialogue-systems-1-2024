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
  staffan : {person : "Staffan Larson"},
  britney : {person : "Britney Spears"},
  lana : {person : "Lana Del Rey"},
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday :{ day: "Wednesday"},
  thursday : {day : "Thursday"},
  "9" : {time : "09:00"},
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12" : {time: "12:00"},
  "1" : {time : "13:00"},
  positive : ["yes", "of course", "sure", "yeah", "yea","yup"],
};

/*const grammarUnderstanding = {
  //continue : ["okay", "ok"],
  positive : ["yes", "of course", "yeah","sure"],
  //negative : ["no", "no way"],
};/*

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}
function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day;
}
function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}
function checkPositive(utterance) {
  return (grammar.positive.includes(utterance.toLowerCase()));
}
function people(grammar) {
  return Object.keys(grammar).filter(key=>grammar[key].person);
}
function days(grammar) {
  return Object.keys(grammar).filter(key=>grammar[key].day);
}
 function time_slots(grammar) {
  return Object.keys(grammar).filter(key=>grammar[key].time);
 }

const dmMachine = setup({
  actions: {
    say: ({ context }, params) =>
    context.ssRef.send({
      type: "SPEAK",
      value: {
        utterance: params,
      },
    }),
    listen : ({context}) =>
    context.ssRef.send({
      type: "LISTEN"
    }),
  },
}).createMachine({
  context: {
    count: 0,
    person : "",
    day : "",
    time: ""
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
      after : {
        10000 : { target : "#DM.PromptAndAsk.Prompt"}
      },
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
                utterance: `Hi, let's make an appointment!`,
              },
            }),
          on: { SPEAK_COMPLETE: "ListenIfAnswer" },
        },
        ListenIfAnswer : {
          entry : [{
            type : "listen" 
          }],
          on : { ASR_NOINPUT : "CantHear",
        RECOGNISED : "Ask"} ,
        },
        CantHear : {
          entry : [{
            type : "say",
            params : `I didn't hear you.`
          }],
          on : {SPEAK_COMPLETE : "AskAgain"},
        },
        AskAgain : {
          entry : [{
            type : "say",
            params : `Hi,let's make an appointment!`
          }],
          on : {SPEAK_COMPLETE : "Listening"},
        },
        Listening: {
          entry: [{
            type : "listen"
          }],
          on: { RECOGNISED : "Ask",
        ASR_NOINPUT : "#DM.WaitToStart" },
        },
        Ask: {
          entry: [{
            type : "say",
            params : `Who are you meeting with?`
          }],
          on: { SPEAK_COMPLETE : "Person"},
        },
          Person : {
            entry : [{
              type : "listen"
            }],
            on : {
            RECOGNISED: [
            {
              guard : ({event}) => isInGrammar(event.value[0].utterance),
              target : "DayQuestion",
              actions : assign({
                person : ({event}) => getPerson(event.value[0].utterance),
              })
            },
            {target : "PossiblePeople"}
            ],
            },
          },
          PossiblePeople : {
            entry : [{
              type: "say",
              params : `You can meet with ${people(grammar)}. Would you like to proceed?`
            }],
            on : {SPEAK_COMPLETE : "ListenToUser"}
          },
          ListenToUser : {
            entry : [{
              type: "listen"
            }],
            on : {
              RECOGNISED : [
                {
               guard : ({event}) => checkPositive(event.value[0].utterance),
               target : "Ask"
              },
              {target : "#DM.Done"},
              ],
            },
        },
        DayQuestion : {
          entry : [{
            type: "say",
            params : `On which day are you meeting?`
          }],
          on : {SPEAK_COMPLETE : "Day"}
        },
        Day: {
          entry : [{
            type : "listen"
          }],
          on : {
            RECOGNISED: [
            {
              guard : ({event}) => isInGrammar(event.value[0].utterance),
              target : "WholeDay",
              actions : assign({
                day : ({event}) => getDay(event.value[0].utterance),
              })
            },
            {target : "PossibleDays"},
            ],
        },
      },
      PossibleDays : {
        entry : [{
          type: "say",
          params : `You can meet on ${days(grammar)}. Would you like to proceed?`
        }],
        on : {SPEAK_COMPLETE : "ListenToAnswer"}
      },
      ListenToAnswer : {
        entry : [{
          type: "listen"
        }],
        on : {
          RECOGNISED : [
            {
           guard : ({event}) => checkPositive(event.value[0].utterance),
           target : "DayQuestion"
          },
          {target : "#DM.Done"},
          ],
        },
    },
    WholeDay : {
      entry : [{
        type : "say",
        params : `Will it take the whole day?`
      }],
      on : {SPEAK_COMPLETE : "WholeDayOrNot"},
    },
    WholeDayOrNot: {
      entry : [{
        type: "listen"
      }],
      on : {
        RECOGNISED : [
          {
         guard : ({event}) => checkPositive(event.value[0].utterance),
         target : "CheckInfo"
        },
        {target : "TimeQuestion"},
        ],
      },
  },
  CheckInfo : {
    entry : [{
      type: "say",
      params : ({context}) => `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`
    }],
 on : {SPEAK_COMPLETE : "ListenCheckInfo"},
  },
  ListenCheckInfo : {
    entry : [{
      type: "listen"
    }],
    on : {
      RECOGNISED : [
        {
       guard : ({event}) => checkPositive(event.value[0].utterance),
       target : "AppointmentCreated"
      },
      {target : "Ask"},
      ],
    },
  },
  AppointmentCreated : {
    entry : [{
      type : "say",
      params : `Your appointment has been created!`
    }],
    on : {SPEAK_COMPLETE : "#DM.Done"}
  },
  TimeQuestion : {
    entry : [{
      type: "say",
      params : `What time is your meeting?`
    }],
  on : {SPEAK_COMPLETE: "Time"}
  },
  Time : {
    entry : [{
      type : "listen"
    }],
    on : {
      RECOGNISED: [
      {
        guard : ({event}) => isInGrammar(event.value[0].utterance),
        target : "CheckAllInfo",
        actions : assign({
          time : ({event}) => getTime(event.value[0].utterance),
        })
      },
      {target : "PossibleTimeSlots"},
      ],
  },
  },
  PossibleTimeSlots : {
    entry : [{
      type: "say",
      params : `You can meet at ${time_slots(grammar)}. Would you like to proceed?`
    }],
    on : {SPEAK_COMPLETE : "ListenForTime"}
  },
  ListenForTime : {
    entry : [{
      type: "listen"
    }],
    on : {
      RECOGNISED : [
        {
       guard : ({event}) => checkPositive(event.value[0].utterance),
       target : "TimeQuestion"
      },
      {target : "#DM.Done"},
      ],
    },
  },
  CheckAllInfo : {
    entry : [{
      type: "say",
      params : ({context}) => `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
    }],
    on : {SPEAK_COMPLETE:"ListenCheckInfo"},
  },
  },
  },
    Done: {
      on: {
        CLICK: "PromptAndAsk",
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
