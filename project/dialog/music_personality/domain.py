from dialog.music_personality import ontology
from dialog.music_personality.ontology import *


class MusicPersonalityDomain:
    def __init__(self, resources, session_data):
        self._case_info = session_data['case_info']
        self._model = resources['extraversion_model_bundle']['model']
        self._scaler = resources['extraversion_model_bundle']['scaler']
        self._features = resources['extraversion_model_bundle']['features']
        self._explainer = resources['explainer']

    def initial_plan(self):
        return [Respond(BooleanQuestion(Extraverted()))]

    def featurize(self):
        feature_value_dict = self._case_info['feature_values']
        unscaled_feature_vector = [
            feature_value_dict[feature_name]
            for feature_name in self._features
        ]
        return self._scaler.transform([unscaled_feature_vector])[0]

    def get_extraversion_belief(self, feature_vector):
        extraversion_prob = self._model.predict_proba([feature_vector])[0][0]
        if extraversion_prob > .5:
            proposition = Extraverted()
            confidence = (extraversion_prob - .5) * 2
        else:
            proposition = Not(Extraverted())
            confidence = (.5 - extraversion_prob) * 2
        return Belief(proposition, confidence)

    def get_answer(self, question):
        if isinstance(question, BooleanQuestion) and question.proposition in [Extraverted(), Not(Extraverted())]:
            feature_vector = self.featurize()
            return self.get_extraversion_belief(feature_vector)
        if question == WhQuestion(FactorsConsidered):
            return Belief(FactorsConsidered(audio_features))

    def is_relevant_answer(self, question, proposition):
        if isinstance(question, Why):
            if isinstance(question.explanandum, Not):
                return self.is_relevant_answer(Why(question.explanandum.content), proposition)
            if question.explanandum == Extraverted():
                return isinstance(proposition, HighValue)
            if isinstance(question.explanandum, HighValue):
                return isinstance(proposition, HigherThanAverage)
            if isinstance(question.explanandum, Explains) and isinstance(proposition, Supports):
                explains = question.explanandum
                for supporting_proposition in self.get_support(explains.explanandum):
                    if supporting_proposition == explains.explanans:
                        return True
        if isinstance(question, BooleanQuestion):
            if question.proposition in [Extraverted(), Not(Extraverted())] and isinstance(proposition, Extraverted):
                return True

    def get_support(self, proposition):
        def get_support_for_prediction(extraverted):
            feature_vector = self.featurize()
            local_contributions = self._explainer.local_contributions(self._model, self._features, feature_vector)
            comparison_function = (lambda feature_name: -local_contributions[feature_name]) if extraverted == 1 \
                else (lambda feature_name: local_contributions[feature_name])
            features_ranked_by_contribution = sorted(local_contributions.keys(), key=comparison_function)
            for feature_name in features_ranked_by_contribution:
                coefficient = self._explainer.global_coefficients(self._model, self._features)[feature_name]
                positive = True if (coefficient > 0 and extraverted == 1) or (
                        coefficient <= 0 and extraverted == 0) else False
                positive_proposition = HighValue(getattr(ontology, feature_name))
                yield positive_proposition if positive else Not(positive_proposition)

        if proposition == Extraverted():
            for supporting_proposition in get_support_for_prediction(1):
                yield supporting_proposition
        elif proposition == Not(Extraverted()):
            for supporting_proposition in get_support_for_prediction(0):
                yield supporting_proposition
        elif isinstance(proposition, HighValue):
            yield HigherThanAverage(proposition.feature)
        elif isinstance(proposition, Not) and isinstance(proposition.content, HighValue):
            yield Not(HigherThanAverage(proposition.content.feature))
