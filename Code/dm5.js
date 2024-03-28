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
  "12": { time: "12:00" },
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

function checkConfidence (confidence) {
  const confidence_score = confidence;
  const threshold = 0.7;
  return confidence_score >= threshold;
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
    time: null,
    outOfGrammarCount: 1,
    noInputCount: 0,
    lastInput: null,
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
          on:{SPEAK_COMPLETE: "Main",}
        },
        Main: {
          initial: "Stage1",
          states: {
            Stage1: {
              initial: "Stage1Prompt",
              states:{
                Stage1Prompt:{
                  entry: [{
                    type: "Say",
                    params: `Hi! You may ask me to make an appointment like "I want to book an appointment with Vlad on Tuesday at 3 p.m.", or ask me about a famous person like "Who is Taylor Swift".`,
                  }],
                  on: { SPEAK_COMPLETE: "Stage1Listen" },
                },
                Stage1Listen: {
                  entry: ({ context }) =>
                    { 
                    context.ssRef.send({
                      type: "LISTEN", value:{ nlu:true, completeTimeout: 5}
                    });},
                  on: {
                    RECOGNISED: [
                      //If saying "Help"
                      {
                        guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          const confidence = event.value[0].confidence;
                          console.log('Recognized Utterance&confidence:', recognizedUtterance,confidence);
                          return ( checkConfidence(confidence)
                            &&recognizedUtterance === 'Help');
                          
                        },
                        actions: { 
                          type: "ShowHelpAndReturn",
                          params: `You are using Help, I'm sending you to the start of the stage.`, 
                        },
                        target: '#DM.Running', 
                      },
                      //If want to book an "appointment" and provided three entities
                      { 
                        guard: ({ event }) => {
                        const recognizedUtterance = event.nluValue;
                        const confidence = event.nluValue.intents[0].confidenceScore;
                        console.log(recognizedUtterance);
                        console.log(checkConfidence(confidence));
                        const entitiesLength = recognizedUtterance.entities.length;
                        return (entitiesLength === 3) && checkConfidence(confidence)
                          && (recognizedUtterance.topIntent === 'create a meeting');
                        },
                        actions:[
                          assign({ person: ({ event }) => event.nluValue.entities[0].text }),
                          assign({ day: ({ event }) => event.nluValue.entities[1].text }),
                          assign({ time: ({ event }) => event.nluValue.entities[2].text }),
                          ({ event }) => console.log(event.nluValue.entities[0].text),
                        ],
                        target: "#DM.Running.Main.Stage7",
                      },
                      //If want to book an "appointment" and did NOT provide three entities
                      { 
                        guard: ({ event }) => {
                        const recognizedUtterance = event.nluValue;
                        const confidence = recognizedUtterance.intents[0].confidenceScore;
                        console.log(recognizedUtterance);
                        console.log(checkConfidence(confidence));
                        const entitiesLength = recognizedUtterance.entities.length;
                        return (entitiesLength <3) && checkConfidence(confidence)
                          && (recognizedUtterance.topIntent === 'create a meeting');
                        },
                        target: "#DM.Running.Main.Stage2",
                      },
                      //If asked about a famous person
                      {
                        target: "#DM.Running.Done",
                        guard: ({ event }) => {    
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = event.nluValue && event.nluValue.entities;
                          if (entities && entities.length > 0) {
                            const recognizedName = entities[0].text;
                            const targetEntityKey = Object.keys(grammar).find(key => grammar[key].person === recognizedName);
                            return checkConfidence(confidence) && event.nluValue.topIntent === "who is X" && targetEntityKey;
                          } else {
                            return false; // Return false if entities or entities[0] is undefined
                          }
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
                      //If confidence is too low
                      { guard: ({ event }) => {
                          const recognizedUtterance = event.value[0].utterance;
                          const confidence = event.value[0].confidence;
                          console.log(recognizedUtterance, confidence);
                          return (!checkConfidence(confidence)
                          );
                        },
                        target: "#DM.Running.Main.Stage1.Stage1ListenConfirmQuestion", 
                      },
                      //If not in grammar
                      {target: "#DM.Running.NotInGrammar",},
                    ],
                  },
                },
                Stage1ListenConfirmQuestion: {
                  entry: [ assign({ lastInput: ({event}) => event.value[0].utterance }),
                    ({ context }) => 
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Do you mean you want to make an appointment?`,
                      },
                    }),],
                  on: {SPEAK_COMPLETE: "Stage1ListenConfirmListen"}
                },
                Stage1ListenConfirmListen: {
                  entry: ({ context }) =>
                    { 
                    context.ssRef.send({
                      type: "LISTEN", value:{ nlu:true, completeTimeout: 5}
                    });},
                  on: {
                    RECOGNISED: [
                      {target: "#DM.Running.Main.Stage2", 
                      guard: ({ event }) => 
                        {const recognizedUtterance = event.value[0].utterance;
                        return (
                          isInGrammar(recognizedUtterance) && 
                          grammar[recognizedUtterance.toLowerCase()].response === 'positive'
                        );
                        },
                      },
                      {target: "#DM.Running.Main",
                      actions: {
                        type: "Say",
                        params: `I see. Let's try again.`,
                      },
                      },
                    ],
                  }
                },
              },
            },
            // if making an appointment but not providing enough entities
            Stage2: {
              initial: "Stage2Prompt",
              on: { SPEAK_COMPLETE: ".Stage2Listen" },
              states:{
                Stage2Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `I see you want to make an appointment. Who are you meeting with and when will it be?`
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Stage2Listen" },
                },
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.Stage2", 
                      },
                      // if all 3 entities are provided
                      { 
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            if (entity.category === 'meeting person') {assign({ person: ({}) => entity.text })}
                            if (entity.category === 'meeting date'){assign({ day: ({}) => entity.text })}
                            if (entity.category === 'meeting time'){assign({ time: ({}) => entity.text })}
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if all the context entities are defined
                          return checkConfidence(confidence)
                            && entitiesLength === 3 && context.person && context.day && context.time;
                          },
                        target: "#DM.Running.Main.Stage7",
                      },
                      // if person name is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context person is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.person;
                          },
                          target: "#DM.Running.Main.Stage3",
                      },
                      // if time is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context time is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.time;
                          },
                          target: "#DM.Running.Main.Stage4",
                      },
                      // if day is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.day;
                          },
                          target: "#DM.Running.Main.Stage5",
                      },
                      // if time and day are provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day and time are defined
                          return checkConfidence(confidence)
                            && entitiesLength === 2 && context.day && context.time;
                          },
                          target: "#DM.Running.Main.AskingName",
                      },
                      // if time and person name are provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context person and time are defined
                          return checkConfidence(confidence)
                            && entitiesLength === 2 && context.person && context.time;
                          },
                          target: "#DM.Running.Main.AskingDay",
                      },
                      // if day and person name are provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context person and day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 2 && context.person && context.day;
                          },
                          target: "#DM.Running.Main.AskingTime",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // if only name is provided; Ask time and day
            Stage3:{
              initial: "Stage3Prompt",
              on: { SPEAK_COMPLETE: ".Stage3Listen" },
              states:{
                Stage3Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `When will your meeting be and what day is it?`
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Stage3Listen" },
                },
                Stage3Listen:{
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.Stage3", 
                      },
                      // if 2 entities are provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context person is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 2 && context.time && context.day;
                          },
                          target: "#DM.Running.Main.Stage7",
                      },
                      // if time is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context time is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.time;
                          },
                          target: "#DM.Running.Main.AskingDay",
                      },
                      // if day is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.day;
                          },
                          target: "#DM.Running.Main.AskingTime",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // if only time is provided; Ask name and day
            Stage4:{
              initial: "Stage4Prompt",
              on: { SPEAK_COMPLETE: ".Stage4Listen" },
              states:{
                Stage4Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `Who are you meeting with and what day is it?`
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Stage4Listen" },
                },
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.Stage4", 
                      },
                      // if 2 entities are provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context person and day are defined
                          return checkConfidence(confidence)
                            && entitiesLength === 2 && context.person && context.day;
                          },
                          target: "#DM.Running.Main.Stage7",
                      },
                      // if name is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context time is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.person;
                          },
                          target: "#DM.Running.Main.AskingDay",
                      },
                      // if day is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.day;
                          },
                          target: "#DM.Running.Main.AskingName",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // if only day is provided; Ask name and time
            Stage5:{
              initial: "Stage5Prompt",
              on: { SPEAK_COMPLETE: ".Stage5Listen" },
              states:{
                Stage5Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `Who are you meeting with and what day is it?`
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Stage5Listen" },
                },
                Stage5Listen:{
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.Stage5", 
                      },
                      // if 2 entities are provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context person and day are defined
                          return checkConfidence(confidence)
                            && entitiesLength === 2 && context.person && context.time;
                          },
                          target: "#DM.Running.Main.Stage7",
                      },
                      // if name is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context time is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.person;
                          },
                          target: "#DM.Running.Main.AskingTime",
                      },
                      // if time is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.day;
                          },
                          target: "#DM.Running.Main.AskingName",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // Need time
            AskingTime:{
              initial: "Prompt",
              on: { SPEAK_COMPLETE: ".Listen" },
              states:{
                Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `What time is your meeting?` 
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Listen" },
                },
                Listen:{
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.AskingTime", 
                      },
                      // if time is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting time' ? assign({ time: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.time;
                          },
                          target: "#DM.Running.Main.Stage7",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // Need day
            AskingDay:{
              initial: "Prompt",
              on: { SPEAK_COMPLETE: ".Listen" },
              states:{
                Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `On what day is your meeting?` 
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Listen" },
                },
                Listen:{
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.AskingDay", 
                      },
                      // if day is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting date' ? assign({ day: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.day;
                          },
                          target: "#DM.Running.Main.Stage7",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // Need Name
            AskingName:{
              initial: "Prompt",
              on: { SPEAK_COMPLETE: ".Listen" },
              states:{
                Prompt:{
                  entry: [
                    {
                    type: "Say",
                    params: `Who are you meeting?` 
                    },
                  ],
                  on: { SPEAK_COMPLETE: "Listen" },
                },
                Listen:{
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
                          params: `You are using Help, I'm sending you to the start.`, 
                        },
                        target: "#DM.Running.Main"
                      },
                      { guard: ({ event }) => {
                        const recognizedUtterance = event.value[0].utterance;
                        const confidence = event.value[0].confidence;
                        console.log(recognizedUtterance, confidence);
                        return (!checkConfidence(confidence)
                        );
                      },
                      target: "#DM.Running.Main.AskingName", 
                      },
                      // if name is provided
                      {
                        guard: ({ event,context }) => {
                          const recognizedUtterance = event.nluValue;
                          const confidence = event.nluValue.intents[0].confidenceScore;
                          console.log(recognizedUtterance);
                          console.log(checkConfidence(confidence));
                          const entities = recognizedUtterance.entities;
                          for (let entity of entities){
                            entity.category === 'meeting person' ? assign({ person: ({}) => entity.text }): null;
                          }
                          const entitiesLength = event.nluValue.entities.length;
                          // check if the context day is defined
                          return checkConfidence(confidence)
                            && entitiesLength === 1 && context.person;
                          },
                          target: "#DM.Running.Main.Stage7",
                      },
                      {
                      target: "#DM.Running.NotInGrammar",
                      }
                    ],
                  },
                },
              },
            },
            // if all entities are provided
            Stage7:{
              entry:({ context }) =>
                context.ssRef.send({
                type: "SPEAK",
                value: {
                  utterance:`Do you want to create an appointment with ${context.person} on ${context.day} at ${context.time}?`},
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
                        target: "#DM.Running.Main.Stage1",reenter:true
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
                      {target: "#DM.Running.Main.Stage1",
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
