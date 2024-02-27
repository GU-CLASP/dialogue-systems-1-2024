import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { NLU_KEY,KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint:
  "https://language-resource-tianyigeng.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
  key: NLU_KEY,
  deploymentName: "appointment",
  projectName: "appointment",

};

const settings = {
  azureLanguageCredentials: azureLanguageCredentials, /** global activation of NLU */
  azureCredentials: azureCredentials, 
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
  //speechRecognitionEndpointId: "9a735a2d-1224-4398-baaa-9b0c80e1032e",
};

/* Grammar definition */
const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  ben: { person: "Ben Test" },
  jack: { person: "Jack Test" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  yes: { response: "positive" },
  no: { response: "negative" },
  ofCourse: { response: "positive" },
  noWay: { response: "negative" },
  taylor: { person: "Taylor Swift", intro: "Taylor Alison Swift (born December 13, 1989) is an American singer-songwriter. Her artistry, songwriting, and entrepreneurship have influenced the music industry, popular culture, and politics, and her life is a subject of widespread media coverage."},
  mahatma: { person: "Mahatma Gandhi", intro: "Mohandas Karamchand Gandhi was an Indian lawyer, anti-colonial nationalist and political ethicist who employed nonviolent resistance to lead the successful campaign for India's independence from British rule."},
  amelia: { person: "Amelia Earhart", intro: "Amelia Mary Earhart was an American aviation pioneer and writer."},
  stephen: { person: "Stephen King", intro: "Stephen Edwin King (born September 21, 1947) is an American author of horror, supernatural fiction, suspense, crime, science-fiction, and fantasy novels."},
  ada: { person:"Ada Lovelace", intro: "Augusta Ada King, Countess of Lovelace was an English mathematician and writer, chiefly known for her work on Charles Babbage's proposed mechanical general-purpose computer, the Analytical Engine. "},
  issac: {person: "Isaac Newton", intro: "Sir Isaac Newton was an English polymath active as a mathematician, physicist, astronomer, alchemist, theologian, and author who was described in his time as a natural philosopher"},
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function getDay(utterance){
  return (grammar[utterance.toLowerCase()] || {}).day;
}

function getTime(utterance){
  return (grammar[utterance.toLowerCase()] || {}).time;
}

const dmMachine = setup({
  actions: {
    Say:({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
        },
      }),
  },
}).createMachine({
  context: {
    person: null,
    day: null,
    time: 0,
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
      after:{
        3000: {
          target: "Running",
        }
      },
      on: {
        CLICK: "Running",
      },
    },
    Running: {
      initial: "Main",
      on: { ASR_NOINPUT : ".NoInput"},
      states: {
        NoInput : {
          entry: ({
            type: "Say",
            params: `Are you there?`,
            }),
          on: { SPEAK_COMPLETE: "Main" },
        },
        Main: {
          initial: "hist",
          states: {
            hist: { type: "history", history: "deep", target: "Prompt"},
            Prompt: {
              entry: [{
                type: "Say",
                params: `Hi!`,
              }],
              on: { SPEAK_COMPLETE: "FirstListen" },
            },
            FirstListen: {
              entry: ({ context }) =>
                context.ssRef.send({
                  type: "LISTEN", value:{ nlu:true, completeTimeout: 5}
                }),
              on: {
                RECOGNISED: [
                  {target: "FirstQuestion",
                  guard: ({ event }) => 
                    {const recognizedUtterance = event.nluValue;
                      console.log(recognizedUtterance);
                    return (
                      recognizedUtterance.topIntent === 'create a meeting'
                    );
                    },
                  },
                  {actions: ({ context, event }) =>
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                      }. And it is not an expected answer in the grammar.`,
                    },
                  }),
                  target: "Prompt",
                  },
                ],
              },
            },
            FirstQuestion: {
              entry: [{
                type: "Say",
                params: `I see you want to make an appointment. Now you may ask me about a famous person.`,
              }], 
              on: { SPEAK_COMPLETE: "SecondListen" },
            },
            SecondListen:{
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN", value:{nlu:true, completeTimeout: 5}
              }),
              on:{
                RECOGNISED: [{
                  target: "SecondQuestion",
                  guard: ({ event }) => 
                    {const recognizedName = event.nluValue.entities[0].text;
                    const targetEntityKey = Object.keys(grammar).find(key => grammar[key].person === recognizedName);
                    return (
                      event.nluValue.topIntent === "who is X" && targetEntityKey
                    );
                    },
                  actions: [
                    ({ context,event }) => 
                    {const recognizedName = event.nluValue.entities[0].text;
                    const targetEntityKey = Object.keys(grammar).find(key => grammar[key].person === recognizedName);
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: ` ${recognizedName} is ${grammar[targetEntityKey].intro}`},})},
                ],
                  },
                  {actions: ({ context, event }) =>
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        Object.keys(grammar).find(key => grammar[key].person === event.nluValue)
                      }. And it is not a name in the grammar, please try again with a name.`,
                    },
                  }),
                  target: "FirstQuestion",
                  }
                ],
              },
            },
            SecondQuestion: {
              entry:[{
                type: "Say",
                params: `On which day is your meeting?`,
              }],
              on: { SPEAK_COMPLETE: "ThirdListen" },
            },
            ThirdListen: {
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN", value:{nlu:true, completeTimeout: 5}
              }),
              on:{
                RECOGNISED: [{
                  guard: ({ event }) => 
                    {const recognizedday = event.value[0].utterance;
                    return (
                      !!getDay(recognizedday)
                    );
                    },
                  actions: [
                    assign({ day: ({event}) => getDay(event.value[0].utterance) }),
                    ({event}) => console.log( getDay(event.value[0].utterance ))
                  ],
                  target: "ThirdQuestion",
                  },
                  {actions: ({ context, event }) =>
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                      }. And it is not a day in the grammar, please try again with a day.`,
                    },
                  }),
                  target: "SecondQuestion",
                  }
                ],
              },
            },
            ThirdQuestion: {
              entry:[{
                type: "Say",
                params: `Will it take the whole day? Answer with yes or no please.`,
              }],
              on: { SPEAK_COMPLETE: "FourthListen" },
            },
            FourthListen:{
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN", value:{nlu:true, completeTimeout: 5}
              }),
              on:{
                RECOGNISED: [
                  {target: "LastQuestion",
                  guard: ({ event }) => 
                    {const answer = event.value[0].utterance;
                      return (
                      answer &&
                      isInGrammar(answer) && 
                      grammar[answer.toLowerCase()].response === 'positive'
                    );
                    },
                  },
                  {target: "FifthQuestion",
                  guard: ({ event }) => 
                    {const answer = event.value[0].utterance;
                    return (
                      answer &&
                      isInGrammar(answer) && 
                      grammar[answer.toLowerCase()].response === 'negative'
                    );
                    },
                  },
                  {actions: ({ context, event }) =>
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                      }. And it is not an expected answer in the grammar, please try again with yes or no`,
                    },
                  }),
                  target: "ThirdQuestion",
                  }
                ],
              },
            },
            FifthQuestion: {
              entry:[{
                type: "Say",
                params: `What time is your meeting?`,
              }],
              on: { SPEAK_COMPLETE: "FifthListen" },
            },
            FifthListen: {
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN", value:{nlu:true, completeTimeout: 5}
              }),
              on:{
                RECOGNISED: [
                  {target: "SixthQuestion",
                  guard: ({ event }) => 
                    {const recognizedtime = event.value[0].utterance;
                    return (
                      !!getTime(recognizedtime)
                    );
                    },
                  actions: [
                    assign({ time: ({event}) => getTime(event.value[0].utterance) }),
                    ({event}) => console.log( getTime(event.value[0].utterance ))
                  ]
                  },
                  {actions: ({ context, event }) =>
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                      }. And it is not a time in the grammar, please try again with a time number from 1 to 24`,
                    },
                  }),
                  target: "FifthQuestion",
                  }
                ],
              },
            },
            SixthQuestion:{
              entry:({ context }) =>
                context.ssRef.send({
                type: "SPEAK",
                value: {
                  utterance:`Do you want to create an appointment with ${context.person} 
                on ${context.day} at ${context.time}?`},
              }),
              on: { SPEAK_COMPLETE: "LastListen" },
            },
            LastQuestion:{
              entry:({ context }) =>
              context.ssRef.send({
              type: "SPEAK",
                value: {
                  utterance: `Do you want to create an appointment with ${context.person} 
                on ${context.day} for the whole day?`},
              }),
              on: { SPEAK_COMPLETE: "LastListen" },
            },
            LastListen:{
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN", value:{nlu:true, completeTimeout: 5}
              }),
              on:{
                RECOGNISED: [
                  {target: "Done",
                  guard: ({ event }) => 
                    {const recognizedUtterance = event.value[0].utterance;
                    return (
                      recognizedUtterance &&
                      isInGrammar(recognizedUtterance) && 
                      grammar[recognizedUtterance.toLowerCase()].response === 'positive'
                    );
                    },
                  },
                  {target: "FirstQuestion",
                  guard: ({ event }) => 
                    {const recognizedUtterance = event.value[0].utterance;
                    return (
                      recognizedUtterance &&
                      isInGrammar(recognizedUtterance) && 
                      grammar[recognizedUtterance.toLowerCase()].response === 'negative'
                    );
                    },
                  actions: {
                    type: "Say",
                    params: `I see. Let's do it over again.`,
                  },
                  },
                  {actions: ({ context, event }) =>
                  context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                      }. And it is not an expected answer in the grammar, please try again with yes or no.`,
                    },
                  }),
                  target: "FifthQuestion",
                  }
                ],
              },
            },
            Done: {
              entry:[{
                type: "Say",
                params: `Your appointment has been created!`,
              }],
              on: { CLICK: "#DM.Running"},
            },
          },
        },
      },
    },
  },
});


const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.log ( state )
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
