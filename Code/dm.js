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
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday :{ day: "Wednesday"},
  thursday : {day : "Thursday"},
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12" : {time: "12:00"},
  "1" : {time : "1:00"}, //didn't recognize 13:00
  "2" : {time : "2:00"},
};
const grammarUnderstanding = {
  continue : ["okay", "ok"],
  positive : ["yes", "of course", "yeah","sure"],
  negative : ["no", "no way"],
};

/* Helper functions */
function isInGrammar(value) {
  for (let key in grammar) {
    if (grammar.hasOwnProperty(key)) {
      if (Object.values(grammar[key]).includes(value)) {
        return true;
      }
    }
  }
  return false;
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
function checkPositive(value) {
  if  (grammarUnderstanding.positive.includes(value)) {
    return true;
  }
}

/*function checkNegative(utterance) {
  for (const key in grammarUnderstanding) {
    if (grammarUnderstanding["negative"].includes(utterance)) {
      return true;
    }
  }
  return false;
} */

const dmMachine = setup({
  actions: { 
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwA2RQFYuGgBwAWQwHZ92-QBoQAT0QBGeyfQaVXRya6L9AZmVqAXwDrNHQAdQJxakFyMSIxYgBhABkASUSAaW4+JBAhUQlpWQUEe011XRU-EwtFEx8fazsEDQ1tdG8GtW9DZRV9IJCMHEEAWzwxUikIUlgAayxsMYnickwWDPpEgHlUTGSmaiZs2XzxSRlcksM1fXR7fRquQ201PTUfDSbEE0d0cxUagsJmMGl6gxAoRG40m01mC2SIlgYjAUhEUigxGYOwA4gA5VLkJjIE65M6FS6gEo6QzqJ56excHzaezaLTfBAmNTOAGM-S+B5+QwQqFLGFTGbzdDw1brUibHZ7A5HUkCYTnIq5ZqeHwuFSOLhGHwmRSNeSIN60tk0pxaDRAxQi4ZiiYS+FYMDYWDSLFMXEEokk3indUU4qIHyGez3Y2GIyKBOR40cuOKdRuQxcNT2RRRvROxbLWGShYAVTwEAIKMwnu9UllGy2u32h2OwbJoYu4YQNLplQ0jOZrPZtkQ5jU6G0ukZQLUpl+A2CkOdRbdUuQBBsvv9hOJqrync1VKU2lp3P7g5Z1o53WjOncl5Mv3sPgL0NdcKl5crKI3W7WjaKi2KrtmqBRdlcJ5nvSA5MleI7NLcaZAg+jjKG0XAmG+LrFu6iLIqi0RTLAADunroPhKL1ti2z4ruQY5GBGqUqOPa5u0PheFynj2KChjWNSp59iosFDta2Grp+CJIlRRFSKR5GUai260QGe72IxB7gUe5o9kJ54iZew6KByihlM4nF1Ny7h8RJ4pSRRMmEYIxFkdgWCdgAbmArmeg28pNkqrb7uSEHHnpGiTqZnHOCoVlPk+maRnZH4lo5BFSHJCnuXiYBQFWIjeb52D+QqzbKm2mmhTp1JtB0xq6JxLI1GY0WYegcXcQlSXCkuoTINIYBJGkmQhYeLElE4d5uE1U6uNy9gcto3iTvYGi-D4L7rRoPiBBCUiCBAcCyGgIbaRNiAALS8fxrGXZFbjuEKbK7dy2H4EQYBncx3a9By+h3moQMfPFvheAWERRDEcTYGI31hpBCDaCYHKtBxvg+PyVTeOtKW4fM8Nhbpl2aByu3tK4-RtKYejJX1K72Wl75wx253dl0HS5kDiWvJhRio-yk7TlwyP6CoILaHja7SRl6JQITNWIHGtKfE4c40+Y2gNDeigTpmdSPOOZQi1LDnwgrF0tLc6haKefj8sjUYcjqeoPoahjGqaptM7WOnVZbHMJjc3IS28Zi3c0Fi6vezw7R7O0mBo3vut+VZgDWXp++N3ZcByvFZug+tmGYrzG5L9OFoz7p-hbOd5wOkWeFZWYzsrydfhWac16zP2I7nrFq3cnUfJodR6I6FfM9L6WyS58lubXiOXXGpkGh1XjxmC2ZrVhk84dPSmZXP2Uz6ii-hf3zRBxxXHWTdYLtzLs-FR54FFfPnrn7pl9KL0kWuN4NwrQEwTyGJXVKeEnJHxfrlfKEh37ZS-iUH+PZXDODeIAzaasuRJwrgNKQX0e4I3CstJaK0G41E+ECJ8-IghBCAA */
  context: {
    count: 0,
    person : "",
    day : "",
    time: "",
    answer : ""
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
                utterance: `Hi, let's make an appointment!`,
              },
            }),
          on: { SPEAK_COMPLETE: "Listening" },
        },
        Listening: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
          on: { RECOGNISED : "Ask" },
        },
          Ask :{
              entry: ({ context }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `Who are you meeting with?`,
                  },
                }),
          on : {SPEAK_COMPLETE : "Person"},
          },
          Person : {
          entry : ({context}) =>
          context.ssRef.send({
            type: "LISTEN",
          }),
          on : {RECOGNISED : "UpdatePerson"},
          },
          UpdatePerson : {
              entry : assign({ 
                person : ({context,event}) =>
              getPerson(event.value[0].utterance),
            }),
            always : [
              {target : "DayQuestion",
              guard : ({context}) => isInGrammar(context.person)
            },
            {target : "#DM.Done" }
            ],
          },
          DayQuestion : {
            entry :
            ({context}) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance : `On which day are you meeting?`,
              },
            }),
          on : {SPEAK_COMPLETE: "Day"},
          },
          Day : {
            entry: ({context}) =>
              context.ssRef.send({
                type:"LISTEN",
          }),
          on : {RECOGNISED : "UpdateDay"},
          },
          UpdateDay : {
            entry :
              assign({
              day : ({context,event}) =>
              getDay(event.value[0].utterance),
            }),
            always : [
              {target : "WholeDay",
              guard : ({context}) => isInGrammar(context.day)},
              {target : "#DM.Done"},
            ],
          },
          WholeDay : {
            entry : ({context}) => 
          context.ssRef.send({
            type : "SPEAK",
            value : {
              utterance : `Will it take the whole day?`
            },
          }),
          on : { SPEAK_COMPLETE : "ListenToAnswer"},
      },
          ListenToAnswer : {
            initial : "Listen",
              states : {
              Listen : {
            entry : ({context}) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
            on : { RECOGNISED: "Answer"},
            },
            Answer : {
              entry :assign ({
                answer : ({context,event}) =>
                event.value[0].utterance}) ,
                always : [
               {
                  target : "PositiveAnswer", 
                  guard : ({context}) => checkPositive(context.answer.toLowerCase()),
              },
                {target : "NegativeAnswer"},
            ],
            },
        PositiveAnswer : {
        initial : "CheckInfo",
        states : {
        CheckInfo : {
          entry : ({context}) =>
          context.ssRef.send({
            type: "SPEAK",
            value : {
              utterance : `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`
            },
          }),
       on : {SPEAK_COMPLETE : "ListenCheckInfo"},
        },
        ListenCheckInfo : {
          entry : ({context}) =>
          context.ssRef.send({
            type : "LISTEN",
          }),
          on : {RECOGNISED : "AnswerCheckInfo"},
        }, 
        AnswerCheckInfo : {
          entry : assign ({
            answer : ({context,event}) =>
            event.value[0].utterance}) , 
            always : [
              {
                target : "Positive",
                guard : ({context}) => checkPositive(context.answer.toLowerCase()),
              },
              {target : "#DM.PromptAndAsk.Ask"},
            ],
        },
        Positive : {
          entry : ({context}) =>
          context.ssRef.send({
            type : "SPEAK",
            value :{
              utterance : `Your appointment has been created!`
            },
          }),
          on : {SPEAK_COMPLETE : "#DM.Done"}
        },
      },
    },     
      NegativeAnswer : {
        initial : "MeetingTime",
        states : {
          MeetingTime : {
        entry : ({context}) =>
        context.ssRef.send({
          type : "SPEAK",
          value : {
          utterance : `What time is your meeting?`
        },
      }),
      on : {SPEAK_COMPLETE: "ListenToTime"}
    },
    ListenToTime : {
      entry : ({context}) => 
      context.ssRef.send({
        type : "LISTEN",
      }),
    on : {RECOGNISED : "UpdateTime"},
  },
  UpdateTime : {
    entry : assign({
        time : ({context,event}) =>
        getTime(event.value[0].utterance),
      }),
      always : [
        {target : "CheckAllInfo",
      guard : ({context}) => isInGrammar(context.time)},
      {target : "#DM.Done"},
      ],
    },
      CheckAllInfo : {
        entry :({context}) =>
      context.ssRef.send({
        type : "SPEAK",
        value : {
          utterance : `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
        },
      }),
    on : {SPEAK_COMPLETE : "ListenCheckInformation"},
    },
    ListenCheckInformation : {
      entry : ({context}) =>
      context.ssRef.send({
        type : "LISTEN",
      }),
      on : {RECOGNISED : "AnswerCheckInformation"},
    },
    AnswerCheckInformation : {
      entry : assign({
        answer : ({context,event}) =>
        event.value[0].utterance}),
        always : [
          {
            target : "#DM.PromptAndAsk.ListenToAnswer.PositiveAnswer.Positive",
            guard : ({context}) => checkPositive(context.answer.toLowerCase()),
          },
          {target : "#DM.PromptAndAsk.Ask"}
        ],
    },
  },
},
},
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
