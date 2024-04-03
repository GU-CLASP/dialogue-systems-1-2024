import { Actor, and, assign, createActor, not, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";
import { NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureLanguageCredentials = {
    endpoint: "https://languageresource12.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" ,
    key: NLU_KEY,
    deploymentName: "appointment" ,
    projectName: "appointment",
  };

  const azureCredentials = {
    endpoint:
      "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
    key: KEY,
  };
  
const settings = {
    azureLanguageCredentials: azureLanguageCredentials ,
    azureCredentials: azureCredentials,
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 5000,
    locale: "en-US",
    ttsDefaultVoice: "en-US-DavisNeural",
  };

/* Grammar definition */
const grammar = {
  'Tom Holland' : 'actor' , 
  'Ryan Reynolds' : 'actor',
  'Tatiany Maslany' : 'actress',
   'Salma Hayek' : 'actress',
  'The Flash' : 'superhero',
  'Queen Elisabeth II' : 'queen',
  'Emily Dickinson' : 'poet',
  'Britney Spears' : 'singer',
  'Big Time Rush' : 'boy band',
};

const help = ['What do you want to do?','Did you say that you want to make an appointment?','Did you ask information about someone?',
              'Say the name of the person you want to meet with.','Tell me the day you want to have the meeting.',
              'Will the meeting last all day?', 'Do you agree with the meeting information?', 'Tell me what time you want to meet.']

/* Helper functions */
function whoIsX(utterance) {
    return grammar[utterance];
}
function isInGrammar(utterance) {
    return utterance in grammar;
  }
function meetingIntent(event) {
  return event === "create a meeting";
}
function confidenceThreshold(event) {
  return event >= 0.8;
}
function whoIsXIntent(event) {
  return event === "Who is X";
}
function checkPositive(event) {
  return event === "positive";
}
function checkNegative(event) {
  return event === "negative";
}
function helpIntent(event) {
  return event === "help";
}
function getDay(entities) {
  const day = [];
  for (const key in entities) {
    if (entities.hasOwnProperty(key)) {
      const entity = entities[key];
      if (entity.category === 'day') {
        day.push(entity.text);
      }
    }
  }
  return day.toString();
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
      type: "LISTEN",
      value: { nlu: true },
    }),
  },
}).createMachine({
  context: {
    re_prompt_count: 0,
    famous_person : "",
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
        10000 : { target : "PromptAndAsk"}
      },
      on: {
        CLICK: "PromptAndAsk", 
      },
    },
    PromptAndAsk : {
      initial : "Prompt",
      states : {
      Prompt: {
      entry : [{type : "say",params : `Hi,how can I help you today?`}],
            on : {SPEAK_COMPLETE : "ListenToChooseIntent"},
        },
    ListenToChooseIntent : {
      entry : "listen",
      on : {  ASR_NOINPUT : [
            {guard: ({context})=> context.re_prompt_count<=1, 
            target: "CantHearIntent",
            actions : ({context})=> context.re_prompt_count++},
            {guard: ({context})=> context.re_prompt_count >1,
            target : "#DM.Done" }],
            RECOGNISED : [
                {guard : and([({event}) => meetingIntent(event.nluValue.topIntent), ({event})=>confidenceThreshold(event.nluValue.intents[0].confidenceScore)]),
                target : "Ask"},
                {guard: and([({event})=> meetingIntent(event.nluValue.topIntent), ({event}) => not(confidenceThreshold(event.nluValue.intents[0].confidenceScore))]),
                target: "DoYouMeanMeeting"},
                {guard : and ([({event}) => whoIsXIntent(event.nluValue.topIntent),({event}) => isInGrammar(event.nluValue.entities[0].text), ({event})=> confidenceThreshold(event.nluValue.intents[0].confidenceScore)]),
                target : "FamousPerson",
                actions : assign({ famous_person : ({event}) => event.nluValue.entities[0].text })},
                {guard : and ([({event}) => whoIsXIntent(event.nluValue.topIntent),({event}) => isInGrammar(event.nluValue.entities[0].text), ({event})=> not(confidenceThreshold(event.nluValue.intents[0].confidenceScore))]),
                target : "DidYouSayWho",
                actions : assign({ famous_person : ({event}) => event.nluValue.entities[0].text })},
                {guard : ({event}) =>  whoIsXIntent(event.nluValue.topIntent), 
                actions : [assign({ famous_person : ({event}) => event.nluValue.entities[0].text }),
                {type : "say", params : ({context}) => `I have no idea who ${context.famous_person} is.`}],
                target : "#DM.Done"},
                {guard :({event})=> helpIntent(event.nluValue.topIntent),
                actions : [{type : "say", params : help[0]}],
                 target : "Prompt"},
                {target : "IntentNotRecognised"} 
        ]
        }
        },
        CantHearIntent : {
          entry : [{type : "say", params : `I didn't hear you.`}],
            on : {SPEAK_COMPLETE : "Prompt"}},
        DoYouMeanMeeting:{
          entry : [{type : "say",params : `Do you want me to create a meeting?`}],
        on : {SPEAK_COMPLETE :  "CheckAnswer"}
        },
        CheckAnswer : {
          entry : [{type: "listen"}],
        on : { ASR_NOINPUT : [
        {guard: ({context})=> context.re_prompt_count<=1, 
        target: "CantHearMeeting",
        actions : ({context})=> context.re_prompt_count++},
        {guard: ({context})=> context.re_prompt_count >1,
        target : "#DM.Done" }
                ],
        RECOGNISED : [
          {guard : ({event}) => checkPositive(event.nluValue.entities[0].category),
          target : "Ask"},
          {guard :({event})=> helpIntent(event.nluValue.topIntent),
                actions : [{type : "say", params : help[1]}],
                 target : "DoYouMeanMeeting"},
          {guard : ({event}) => checkNegative(event.nluValue.entities[0].category),
          target : "Prompt"},
        {target : "IntentNotRecognised"},
        ],
        },
      },
      CantHearMeeting : {
        entry : [{type : "say", params : `I didn't hear you.`}],
          on : {SPEAK_COMPLETE : "DoYouMeanMeeting"}},
        DidYouSayWho : {
          entry : [{type : "say",params : `Do you want to know who someone is?`}], 
          on : {SPEAK_COMPLETE : "CheckInfoWho"}
        },
        CheckInfoWho :{
          entry : [{type: "listen"}],
        on : { ASR_NOINPUT : [
        {guard: ({context})=> context.re_prompt_count<=1, 
        target: "CantHearWho",
        actions : ({context})=> context.re_prompt_count++},
        {guard: ({context})=> context.re_prompt_count >1,
        target : "#DM.Done" }
                ],
        RECOGNISED : [
          {guard : ({event}) => and([checkPositive(event.nluValue.entities[0].category),({context})=>isInGrammar(context.famous_person)]),
          target : "FamousPerson"},
          {guard : ({event}) => and([checkPositive(event.nluValue.entities[0].category),({context})=>not(isInGrammar(context.famous_person))]),
          actions : { type : "say", params : ({context}) => `I have no idea who ${context.famous_person} is.`}},
          {guard : and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length === 0 ]),
                actions : [{type : "say", params : help[2]}],
                 target : "DidYouSayWho"},
          {guard : ({event}) => checkNegative(event.nluValue.entities[0].category),
          target : "Prompt"},
        {target : "IntentNotRecognised"},
        ],
        },
        },
        CantHearWho : {
            entry : [{type : "say", params : `I didn't hear you.`}],
              on : {SPEAK_COMPLETE : "DidYouSayWho"}},
        FamousPerson : {
            entry: [{
                type : "say",
                params : ({context}) => `${context.famous_person} is a famous ${whoIsX(context.famous_person)}`
              }],
              on : {SPEAK_COMPLETE : "#DM.Done"}
            },
        IntentNotRecognised : {
            entry : [{type : "say",params : `I am sorry I can't help you with that.`}],
              on : {SPEAK_COMPLETE : "#DM.Done"}
        },
        Ask: {
          entry: [{
            type : "say",
            params : `Who are you meeting with?`
          }],
          on: { SPEAK_COMPLETE : "ListenForPerson"},
        },
        ListenForPerson :{
            entry : [{type : "listen"}],
          on : { 
            ASR_NOINPUT : [
            {guard: ({context})=> context.re_prompt_count<=1, 
            target: "CantHearAsk",
            actions : ({context})=> context.re_prompt_count++},
            {guard: ({context})=> context.re_prompt_count >1,
            target : "#DM.Done" }],
            RECOGNISED : [
            {guard :and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length === 0 ]),
            actions : [{type : "say", params : help[3]}],
            target : "Ask"},
            {guard : ({event})=> event.nluValue.entities.length === 0,
            target : "Ask"},
            { guard : ({event}) => event.nluValue.entities[0].length > 0,
            actions : assign({ person : ({event}) => event.nluValue.entities[0].text }),
            target : "DayQuestion"},
            {target : "IntentNotRecognised"}]
            }
          },
          CantHearAsk : {
            entry : [{type : "say", params : `I didn't hear you.`}],
              on : {SPEAK_COMPLETE : "Ask"}},
        DayQuestion : {
          entry : [{
            type: "say",
            params : `On which day are you meeting?`
          }],
          on : {SPEAK_COMPLETE : "Day"}
        },
        Day: {
          entry : [{type : "listen"}],
          on : {
            ASR_NOINPUT : [
              {guard: ({context})=> context.re_prompt_count<=1, 
              target: "CantHearDay",
              actions : ({context})=> context.re_prompt_count++},
              {guard: ({context})=> context.re_prompt_count >1,
              target : "#DM.Done" }],
            RECOGNISED : [
              {guard :and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length === 0 ]),
              actions : {type : "say", params : help[4]},
              target : "DayQuestion"},
              {guard : ({event}) =>  event.nluValue.entities[0].length > 0,
              actions : assign({ day : ({event}) => getDay(event.nluValue.entities)
             }),
              target : "WholeDay"},
              {target : "ChooseDay"}]
          }
        },
        ChooseDay : {
          entry : [{type : "say", params : `You need to tell me a day`}],
          on : {SPEAK_COMPLETE : "DayQuestion"}
        },
        CantHearDay : {
          entry : [{type : "say", params : `I didn't hear you.`}],
            on : {SPEAK_COMPLETE : "DayQuestion"}},
    WholeDay : {
      entry : [{
        type : "say",
        params : `Will it take the whole day?`
      }],
      on : {SPEAK_COMPLETE : "WholeDayOrNot"},
    },
    WholeDayOrNot: {
      entry : [{type: "listen"}],
      on : {
        ASR_NOINPUT : [
          {guard: ({context})=> context.re_prompt_count<=1, 
          target: "CantHearWholeDay",
          actions : ({context})=> context.re_prompt_count++},
          {guard: ({context})=> context.re_prompt_count >1,
          target : "#DM.Done" }],
        RECOGNISED : [
            {guard :and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length === 0 ]),
            actions : [{type : "say", params : help[5]}],
            target : "WholeDay"},
            {guard : ({event}) => checkPositive(event.nluValue.entities[0].category),
            target : "CheckInfo"},
            {guard : ({event}) => checkNegative(event.nluValue.entities[0].category),
            target : "TimeQuestion"},
            {target : "IntentNotRecognised"},
          ]
      },
  },
  CantHearWholeDay : {
    entry : [{type : "say", params : `I didn't hear you.`}],
      on : {SPEAK_COMPLETE : "WholeDay"}},
  CheckInfo : {
    entry : [{type: "say",params : ({context}) => `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`}],
 on : {SPEAK_COMPLETE : "ListenCheckInfo"},
  },
  ListenCheckInfo : {
    entry : [{type: "listen"}],
    on : {
      ASR_NOINPUT : [
        {guard: ({context})=> context.re_prompt_count<=1, 
        target: "CantHearCheckInfo",
        actions : ({context})=> context.re_prompt_count++},
        {guard: ({context})=> context.re_prompt_count >1,
        target : "#DM.Done" }],
      RECOGNISED : [
        {guard : ({event}) => checkPositive(event.nluValue.entities[0].category),
        target : "AppointmentCreated"},
        {guard : ({event})=> checkNegative(event.nluValue.entities[0].category),
        target : "Ask"},
        {guard :and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length === 0 ]),
              actions : [{type : "say", params : help[6]}],
              target : "CheckInfo"},
        {target : "IntentNotRecognised"}
      ],
    },
  },
  CantHearCheckInfo : {
    entry : [{type : "say", params : `I didn't hear you.`}],
      on : {SPEAK_COMPLETE : "CheckInfo"}},
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
    entry : [{type : "listen"}],
    on : {
      ASR_NOINPUT : [
        {guard: ({context})=> context.re_prompt_count<=1, 
        target: "CantHearTime",
        actions : ({context})=> context.re_prompt_count++},
        {guard: ({context})=> context.re_prompt_count >1,
        target : "#DM.Done" }],
        RECOGNISED : [
          {guard : and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length == 0 ]),
          actions : [{type : "say", params : help[7]}],
          target : "TimeQuestion"},
          {guard : ({event}) => event.nluValue.entities[0].length > 0,
            actions : assign({ time : ({event}) => event.nluValue.entities[0].text}),
            target : "CheckAllInfo" },
          {target : "IntentNotRecognised"}]
        }
      },
  CantHearTime : {
        entry : [{type : "say", params : `I didn't hear you.`}],
          on : {SPEAK_COMPLETE : "TimeQuestion"}},
  CheckAllInfo : {
    entry : [{
      type: "say",
      params : ({context}) => `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
    }],
    on : {SPEAK_COMPLETE: "ListenCheckAllInfo" },
  },
  ListenCheckAllInfo : {
    entry : [{type: "listen"}],
    on : {
      ASR_NOINPUT : [
        {guard: ({context})=> context.re_prompt_count<=1, 
        target: "CantHearCheckAllInfo",
        actions : ({context})=> context.re_prompt_count++},
        {guard: ({context})=> context.re_prompt_count >1,
        target : "#DM.Done" }],
      RECOGNISED : [
        {guard : ({event}) => checkPositive(event.nluValue.entities[0].category),
        target : "AppointmentCreated"},
        {guard : ({event})=> checkNegative(event.nluValue.entities[0].category),
        target : "Ask"},
        {guard :and([({event})=> helpIntent(event.nluValue.topIntent), ({event}) => event.nluValue.entities.length === 0 ]),
              actions : [{type : "say", params : help[6]}],
              target : "CheckAllInfo"},
        {target : "IntentNotRecognised"}
      ],
    },
  },
  CantHearCheckAllInfo : {
    entry : [{type : "say", params : `I didn't hear you.`}],
      on : {SPEAK_COMPLETE : "CheckAllInfo"}},
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
