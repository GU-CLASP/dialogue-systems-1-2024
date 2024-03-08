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

// Helper function to generate re-prompt formulations
function generateRepromptFormulation(repromptCounter) {
  switch (repromptCounter) {
    case 1:
      return `Your answer is not in the grammar.`;
    case 2:
      return `Sorry, I still didn't find your answer in the grammar.`;
    case 3:
      return `I apologize, but it seems like there's no corresponding item in the grammar.`;
  }
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
    ShowHelpAndReturn: ({ context }, params) => {
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
        },
      }); 
    },
    HandleOutOfGrammar: ({ context }) => {
      if (context.outOfGrammarCount <=3 ) {
        const repromptFormulation = generateRepromptFormulation(context.outOfGrammarCount);
        context.ssRef.send({
          type: "SPEAK",
          value: { utterance: repromptFormulation },});
        context.outOfGrammarCount += 1;
      } else {
        return "#DM.Running.Done";
      }
    },
  },
}).createMachine({
  context: {
    person: null,
    day: null,
    time: 0,
    outOfGrammarCount: 1,
    noInputCount: 0,
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
          on: { 
            SPEAK_COMPLETE: [
              {
                guard:({ context }) => {
                  console.log(context.noInputCount);
                  return (context.noInputCount === 3);
                },
                target: "NoResponse",
              },
              {
                actions:
                [
                  assign({ 
                    noInputCount: ({context}) => context.noInputCount + 1,
                  }),
                  ({context}) => console.log( context.noInputCount ),
                ],
                target: "Main",
              },
            ],
          },
        },
        NotInGrammar: {
          entry: [
            {type:"HandleOutOfGrammar"}
          ],
          on:{SPEAK_COMPLETE: "Main"}
        },
        Main: {
          initial: "hist",
          states: {
            hist: { type: "history", target: "Stage1", reenter: true},
            Stage1: {
              entry: [{
                type: "Say",
                params: `Hi! You are entering stage1. What can I help you?`,
              }],
              initial: "Stage1Listen",
              on: { SPEAK_COMPLETE: ".Stage1Listen" },
              states:{
                Stage1Listen: {
                  entry: ({ context }) =>
                    { 
                    context.ssRef.send({
                      type: "LISTEN", value:{ nlu:true, completeTimeout: 5}
                    });},
                  on: {
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: '#DM.Running.Main',reenter:true
                      },
                      {target: "Stage1Ending",
                      guard: ({ event }) => 
                        {const recognizedUtterance = event.nluValue;
                          console.log(recognizedUtterance);
                        return (
                          recognizedUtterance.topIntent === 'create a meeting'
                        );
                        },
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      },
                    ],
                  },
                },
                Stage1Ending: {
                  entry: [{
                    type: "Say",
                    params: `I see you want to make an appointment. You are entering Stage2.`,
                  }], 
                  on: { SPEAK_COMPLETE: "#DM.Running.Main.Stage2" },
                },
              },
            },
            Stage2: {
              entry: [{
                  type: "Say",
                  params: `Ask me about a famous person.`,
              }],
              initial: "Stage2Listen",
              on: { SPEAK_COMPLETE: ".Stage2Listen" },
              states:{
                Stage2Listen:{
                  entry: ({ context }) =>
                  context.ssRef.send({
                    type: "LISTEN", value:{nlu:true, completeTimeout: 5}
                  }),
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      {
                      target: "Stage2Ending",
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
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
                Stage2Ending: {
                  entry:[{
                    type: "Say",
                    params: `You are entering Stage3.`,
                  }],
                  on: { SPEAK_COMPLETE: "#DM.Running.Main.Stage3" },
                },
              }
            },
            Stage3: {
              entry: [{
                type: "Say",
                params: `On which day is your meeting?`,
            }],
              initial:"Stage3Listen",
              on: { SPEAK_COMPLETE: ".Stage3Listen" },
              states:{
                Stage3Listen: {
                  entry: ({ context }) =>
                  context.ssRef.send({
                    type: "LISTEN", value:{nlu:true, completeTimeout: 5}
                  }),
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: "#DM.Running.Main",reenter:true
                      },
                      {
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
                      target: "Stage3Ending",
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
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
                Stage3Ending: {
                  entry:[{
                    type: "Say",
                    params: `You are entering Stage4.`,
                  }],
                  on: { SPEAK_COMPLETE: "#DM.Running.Main.Stage4" }
                },
              },
            },
            Stage4: {
              entry: [{
                type: "Say",
                params: `Will it take the whole day? Answer with yes or no please.`,
              }],
              initial: "Stage4Listen",
              on: { SPEAK_COMPLETE: ".Stage4Listen" },
              states:{
                Stage4Listen:{
                  entry: ({ context }) =>
                  context.ssRef.send({
                    type: "LISTEN", value:{nlu:true, completeTimeout: 5}
                  }),
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: "#DM.Running.Main",reenter:true
                      },
                      {target: "Stage4Ending_wholeday",
                      guard: ({ event }) => 
                        {const answer = event.value[0].utterance;
                          return (
                          answer &&
                          isInGrammar(answer) && 
                          grammar[answer.toLowerCase()].response === 'positive'
                        );
                        },
                      },
                      {target: "Stage4Ending_time",
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
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
                Stage4Ending_wholeday: {
                  entry:[{
                    type: "Say",
                    params: `You are entering Stage6, whole-day confirming`,
                  }],
                  on: { SPEAK_COMPLETE: "#DM.Running.Main.Stage6" },
                },
                Stage4Ending_time: {
                  entry:[{
                    type: "Say",
                    params: `You are entering Stage5, time confirming`,
                  }],
                  on: { SPEAK_COMPLETE: "#DM.Running.Main.Stage5" },
                },
              },
            },
            Stage5:{
              entry: [{
                  type: "Say",
                  params: `What time is your meeting?`,
              }],
              initial: "Stage5Listen",
              on: { SPEAK_COMPLETE: ".Stage5Listen" },
              states:{
                Stage5Listen: {
                  entry: ({ context }) =>
                  context.ssRef.send({
                    type: "LISTEN", value:{nlu:true, completeTimeout: 5}
                  }),
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: "#DM.Running.Main",reenter:true
                      },
                      {target: "Stage5Ending",
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
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
                Stage5Ending:{
                  entry:({
                    type: "Say",
                    params: `You are entering Stage7, final confirming.`,
                  }),
                  on: { SPEAK_COMPLETE: "#DM.Running.Main.Stage7" },
                },
              },
            },
            Stage6:{
              entry:({ context }) =>
                context.ssRef.send({
                type: "SPEAK",
                  value: {
                    utterance: `Do you want to create an appointment with ${context.person} 
                  on ${context.day} for the whole day?`},
                }),
              initial: "Stage6Listen",
              on: { SPEAK_COMPLETE: ".Stage6Listen" },
              states:{
                Stage6Listen:{
                  entry: ({ context }) =>
                  context.ssRef.send({
                    type: "LISTEN", value:{nlu:true, completeTimeout: 5}
                  }),
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: "#DM.Running.Main",reenter:true
                      },
                      {target: "#DM.Running.Done",
                      guard: ({ event }) => 
                        {const recognizedUtterance = event.value[0].utterance;
                        return (
                          recognizedUtterance &&
                          isInGrammar(recognizedUtterance) && 
                          grammar[recognizedUtterance.toLowerCase()].response === 'positive'
                        );
                        },
                      },
                      {target: "#DM.Running.Main.Stage2",
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
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            Stage7:{
              entry:({ context }) =>
                context.ssRef.send({
                type: "SPEAK",
                value: {
                  utterance:`Do you want to create an appointment with ${context.person} 
                on ${context.day} at ${context.time}?`},
                }),
              initial: "Stage7Listen",
              on: { SPEAK_COMPLETE: ".Stage7Listen" },
              states:{
                Stage7Listen:{
                  entry: ({ context }) =>
                  context.ssRef.send({
                    type: "LISTEN", value:{nlu:true, completeTimeout: 5}
                  }),
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          console.log('Recognized Utterance:', recognizedUtterance);
                          return (recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: "#DM.Running.Main.Stage5",reenter:true
                      },
                      {target: "#DM.Running.Done",
                      guard: ({ event }) => 
                        {const recognizedUtterance = event.value[0].utterance;
                        return (
                          recognizedUtterance &&
                          isInGrammar(recognizedUtterance) && 
                          grammar[recognizedUtterance.toLowerCase()].response === 'positive'
                        );
                        },
                      },
                      {target: "#DM.Running.Main.Stage2",
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
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
          },
        },
        Done: {
          entry:[{
            type: "Say",
            params: `Your appointment has been created!`,
          }],
          on: { CLICK: "Main"},
        },
        NoResponse: {
          entry:[{
            type: "Say",
            params: `Too much false input. The program is ended.`,
          }],
          on: { CLICK: "Main"},
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
