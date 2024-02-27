import yaml

import openai

import dialog.music_personality.ontology
from dialog import semantic_serialization
from dialog.logger import logger


semantic_serialization.register_module(dialog.music_personality.types)
config = yaml.load(open('dialog/music_personality/nlu_openai_config.yml'), yaml.Loader)


def interpret(utterance):
    completion = openai.ChatCompletion.create(
        model=config['model'],
        temperature=config['temperature'],
        max_tokens=config['max_tokens'],
        messages=[
            {'role': 'system', 'content': config['prompt']},
            {'role': 'user', 'content': utterance},
        ])
    logger.info('response from OpenAI chat completion', response=completion.choices)
    move_representation = completion.choices[0].message.content
    try:
        return semantic_serialization.deserialize(move_representation)
    except semantic_serialization.DeserializationException as exception:
        logger.exception(str(exception))
        return None

