from dialog.music_personality import ontology
from dialog.music_personality.ontology import *
from dialog.music_personality.nl import feature_value_forms


def interpret(utterance_cased):
    utterance = utterance_cased.lower()
    tokens = utterance.rstrip('.?!').split(' ')

    def detect_extraversion_proposition():
        if 'introverted' in tokens:
            return Not(Extraverted())
        if 'extraverted' in tokens:
            return Extraverted()

    def detect_feature_value_judgement_proposition():
        for feature_name, polarity_and_form_dict in feature_value_forms.items():
            for polarity, form in polarity_and_form_dict.items():
                if form in utterance:
                    positive_proposition = HighValue(getattr(ontology, feature_name))
                    return positive_proposition if polarity == True else Not(positive_proposition)

    def try_interpret_as_why_question_concerning_explanation():
        extraversion_proposition = detect_extraversion_proposition()
        if extraversion_proposition:
            feature_value_judgement_proposition = detect_feature_value_judgement_proposition()
            if feature_value_judgement_proposition:
                return Ask(Why(Explains(feature_value_judgement_proposition, extraversion_proposition)))

    extraversion_proposition = detect_extraversion_proposition()
    feature_value_judgement_proposition = detect_feature_value_judgement_proposition()

    if 'why' in tokens:
        if extraversion_proposition:
            return Ask(Why(extraversion_proposition))
        if feature_value_judgement_proposition:
            return Ask(Why(feature_value_judgement_proposition))
        return Ask(Why())
    if 'how' in tokens and 'explain' in tokens:
        move = try_interpret_as_why_question_concerning_explanation()
        if move:
            return move
    if "don't understand" in utterance or 'so what' in utterance:
        return ICM(understanding, negative)
    if 'support' in tokens:
        if extraversion_proposition and feature_value_judgement_proposition:
                return Ask(BooleanQuestion(Supports(feature_value_judgement_proposition, extraversion_proposition)))
    if 'think' in tokens and 'you' in tokens and extraversion_proposition:
        return Ask(BooleanQuestion(extraversion_proposition))
    if 'think' in tokens and 'i' in tokens and extraversion_proposition:
        return Assert(extraversion_proposition)
    if 'which factors' in utterance:
        return Ask(WhQuestion(FactorsConsidered))
    if utterance == 'ok':
        return ICM(acceptance, positive)
