// -*- js-indent-level: 2 -*-
import { assign, createActor, setup, and } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureLanguageCredentials = {
  endpoint: "https://dialogue2024123.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
  key: NLU_KEY,
  deploymentName: "appointment",
  projectName: "appointment",
};

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
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
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  andreas: { person: "Andreas Henriksson" },

  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  saturday: { day: "Saturday" },
  sunday: { day: "Sunday" },

  tomorrow: { day: "tomorrow" },
  "the day after tomorrow": { day: "The day after tomorrow" },

  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "13": { time: "13:00" },
  // ...
};

const confidence_threshold = 0.5;


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


const yesGrammar = new Set([
  "yes", "yeah", "of course", "sure", "yup",
]);
const noGrammar = new Set([
  "no", "nope", "no way", "nah",
]);

function isYes(utterance) {
  return yesGrammar.has(utterance.toLowerCase());
}

function isNo(utterance) {
  return noGrammar.has(utterance.toLowerCase());
}

function isHelp(utterance) {
  return utterance.toLowerCase() === "help";
}

function hasCelebrity(nluValue) {
  return nluValue.entities.length == 1 && nluValue.entities[0].category === "celebrity";
}

function getCelebrity(nluValue) {
  console.assert(nluValue.entities[0].extraInformation[0].extraInformationKind === "ListKey");

  const celebrity = nluValue.entities[0].extraInformation[0].key;
  return celebrity;
}

// from Wikipedia
const explainCelebrityText = {
  "Johnny Cash": "Johnny Cash was an American country singer-songwriter. He was known for his deep, calm, bass-baritone voice.",
  "Laura Les": "Laura Les is an American music producer, singer and songwriter best known as one half of experimental electronic duo 100 gecs.",
};

function explainCelebrity(celebrity) {
  return explainCelebrityText[celebrity];
}


// utility function to handle queries that are pure strings
function ensure_fn(query) {
  if (typeof query === "string")
    return (({context}) => query);
  return query;
}


function make_ask_information_states(state_name, query, elaboration, fn, next_state) {
  return {
    [state_name]: {
      entry: [
        ({ context, event }) => { context.tries = 0; },
      ],
      always: [
        {
          guard:  fn.check_unset || (() => true),
          target: "Do" + state_name,
        },
        {
          // skip ahead if information was already given
          target: next_state,
        },
      ],
    },
    ["Do" + state_name]: {
      entry: [
        {
          type: 'say',
          // elaborate on the expected answer on the final try
          params: ({ context }) => ensure_fn(query)({context}) + ((context.tries === 2) ? " " + elaboration : ""),
        },
      ],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: and([
              fn.check_response_in_grammar,
              ({ context, event }) => (event.value[0].confidence >= confidence_threshold)
            ]),
            actions: [
              fn.update_information,
            ],
            target: next_state,
          },
          {
            guard:   fn.check_response_in_grammar,
            actions: [
              fn.update_information,
            ],
            // move to yes-no question, keeping the proposed answer in 'context'
            target: "Unconfident" + state_name,
          },
          {
            guard: ({ context, event }) => isHelp(event.value[0].utterance),
            target: "Help" + state_name,
          },
          "Unknown" + state_name,
        ],
        ASR_NOINPUT: "Reset" + state_name,
      },
    },
    ["Help" + state_name]: {
      entry: [{ type: 'say', params: elaboration }],
      on: { SPEAK_COMPLETE: "Do" + state_name },
    },
    ...make_repeat_states(state_name),

    // returns to DoStateName if answer is no, this works because the skip check happens in StateName
    ...make_yesno_states("Unconfident" + state_name, fn.confirm_information_query, next_state, "Do" + state_name),
  };
}

function make_yesno_states(state_name, query, yes_state, no_state) {
  const elaboration = "Answer with yes or no";

  return {
    [state_name]: {
      entry: [
        ({ context, event }) => { context.tries = 0; },
      ],
      always: "Do" + state_name,
    },
    ["Do" + state_name]: {
      entry: [
        {
          type: 'say',
          // elaborate on the expected answer on the final try
          params: ({ context }) => ensure_fn(query)({context}) + ((context.tries === 2) ? " " + elaboration : ""),
        },
      ],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          //
          // Don't take confidence into account for these kinds of
          // yes/no questions; there is little chance for mishearing,
          // and it might put us in an endless loop of "Did you mean
          // 'yes'?" "yes"
          //
          {
            guard: ({ context, event }) => isYes(event.value[0].utterance),
            target: yes_state,
          },
          {
            guard: ({ context, event }) => isNo(event.value[0].utterance),
            target: no_state,
          },
          "Unknown" + state_name,
        ],
        ASR_NOINPUT: "Reset" + state_name,
      },
    },
    ["Help" + state_name]: {
      entry: [{ type: 'say', params: elaboration }],
      on: { SPEAK_COMPLETE: "Do" + state_name },
    },
    ...make_repeat_states(state_name),
  };
}

function make_repeat_states(state_name) {
  return {
    ["Reset" + state_name]: make_repeat_state("I didn't hear you", "Do" + state_name),
    ["Unknown" + state_name]: make_repeat_state("I didn't understand", "Do" + state_name),
  };
}

function make_repeat_state(message, next_state) {
  return {
    entry: [
      ({ context, event }) => { context.tries += 1; },
      { type: 'say', params: message },
    ],
    on: {
      SPEAK_COMPLETE: [
        {
          // go to end after 3 tries
          guard: ({ context, event }) => context.tries >= 3,
          target: "#DM.WaitToStart",
        },
        next_state,
      ],
    },
  };
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
    listen: ({ context }, params) =>
      context.ssRef.send({
        type: "LISTEN",
        value: {}, // workaround for some incompatibility I encountered
      }),
    listen_nlu: ({ context }, params) =>
      context.ssRef.send({
        type: "LISTEN",
        value: { nlu: true },
      }),
  },
}).createMachine({
  context: {},
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
        CLICK: {
          target: "DoReceiveInstruction",
          actions: [
            ({ context, event }) => {
              context.name = undefined;
              context.date = undefined;
              context.take_whole_day = undefined;
              context.time =  undefined;

              context.celebrity = undefined;
            },
          ],
        },
      },
    },
    DoReceiveInstruction: {
      entry: ["listen_nlu"],
      on: {
        RECOGNISED: [
          {
            guard: ({ context, event }) => event.nluValue.topIntent === "create_meeting",
            actions: [
              ({ context, event }) => {
                for (const entity of event.nluValue.entities) {
                  // set person
                  if (entity.category === "person" ) {
                    for (const extra_info of entity.extraInformation) {
                      if (extra_info.extraInformationKind === "ListKey")
                        context.name = extra_info.key;
                    }
                    console.assert(context.name !== undefined); // there should be a listkey in that array
                  }
                  // set day and/or time
                  if (entity.category === "day" ) {
                    // assume the first resolution is correct
                    const resolution = entity.resolutions[0];

                    console.assert(resolution.resolutionKind === "DateTimeResolution");

                    // TODO: this is probably a bit too hacky
                    const [date, time] = resolution.timex.split("T");

                    if (date)
                      context.date = date;
                    if (time) {
                      context.time = time;
                      context.take_whole_day = false;
                    }
                  }
                }
                console.log(context);
              },
            ],
            target: "AskName",
          },
          {
            guard: ({ context, event }) => event.nluValue.topIntent === "who_is_x" && hasCelebrity(event.nluValue),
            actions: [
              ({ context, event }) => { context.celebrity = getCelebrity(event.nluValue); },
            ],
            target: "ExplainCelebrity",
          },
          {
            target: "UnknownReceiveInstruction",
          },
        ],
        ASR_NOINPUT: "ResetReceiveInstruction",
      },
    },
    ...make_repeat_states("ReceiveInstruction"),

    ...make_ask_information_states(
      "AskName", "Who are you meeting with?", "Answer with a valid name",
      {
        check_unset: ({ context, event }) => context.name === undefined,
        check_response_in_grammar: ({ context, event }) => getPerson(event.value[0].utterance) !== undefined,
        update_information: ({ context, event }) => { context.name = getPerson(event.value[0].utterance) },
        confirm_information_query: ({ context }) => `You're meeting with ${context.name}?`,
      },
      "AskDay"
    ),

    ...make_ask_information_states(
      "AskDay", "On which day is your meeting?", "Answer with a weekday",
      {
        check_unset: ({ context, event }) => context.date === undefined,
        check_response_in_grammar: ({ context, event }) => getDay(event.value[0].utterance) !== undefined,
        update_information: ({ context, event }) => { context.date = getDay(event.value[0].utterance) },
        confirm_information_query: ({ context }) => `The meeting is on ${context.date}?`,
      },
      "AskTakeWholeDay"
    ),

    ...make_ask_information_states(
      "AskTakeWholeDay", "Will it take the whole day?", "Answer with yes or no",
      {
        check_unset: ({ context, event }) => context.take_whole_day === undefined,
        check_response_in_grammar: ({ context, event }) => isYes(event.value[0].utterance) || isNo(event.value[0].utterance),
        update_information: ({ context, event }) => { context.take_whole_day = isYes(event.value[0].utterance) },

        // We need to be careful about how we ask to confirm that the meeting will not take the whole day,
        // if we simply say "It will not take the whole day?", the user would answer "no" to confirm.
        // This still isn't perfect...
        confirm_information_query: ({ context }) => context.take_whole_day ? "It will take the whole day?" : "Did you say that it won't take the whole day?",
      },
      "AskTime"
    ),

    ...make_ask_information_states(
      "AskTime", "What time is your meeting?", "Answer with a time of day",
      {
        check_unset: ({ context, event }) => context.take_whole_day === false && context.time === undefined,
        check_response_in_grammar: ({ context, event }) => getTime(event.value[0].utterance) !== undefined,
        update_information: ({ context, event }) => { context.time = getTime(event.value[0].utterance) },
        confirm_information_query: ({ context }) => `The meeting is at ${context.time}?`,
      },
      "BookMeeting"
    ),

    BookMeeting: {
      always: [
        {
          guard: ({ context, event }) => context.take_whole_day === true,
          target: "BookMeetingWholeDay",
        },
        {
          target: "BookMeetingAtTime",
        },
      ],
    },

    ...make_yesno_states(
      "BookMeetingWholeDay",
      ({ context }) => `Do you want me to create an appointment with ${context.name} on ${context.date} for the whole day?`,
      "Finalize",
      "AskName",
    ),

    ...make_yesno_states(
      "BookMeetingAtTime",
      ({ context }) => `Do you want me to create an appointment with ${context.name} on ${context.date} at ${context.time}?`,
      "Finalize",
      "AskName",
    ),

    Finalize: {
      entry: [{
        type: 'say',
        params: ({ context }) => "Your appointment has been created!",
      }],
      on: {
        SPEAK_COMPLETE: "#DM.WaitToStart",
      }
    },

    ExplainCelebrity: {
      entry: [{
        type: 'say',
        params: ({ context }) => explainCelebrity(context.celebrity),
      }],
      on: {
        SPEAK_COMPLETE: "#DM.WaitToStart",
      },
    }
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
