from dialog.ontology import *
from dialog.rule import Rule
from dialog.semantics import *
from dialog.pragmatics import *
from dialog.logger import logger


class GetLatestMoves(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        return True

    @staticmethod
    def effects(state: DialogState):
        state.private.non_integrated_moves = []
        state.shared.latest_moves = []
        if state.user_input and state.user_input.move:
            state.private.non_integrated_moves.append(state.user_input.move)
            state.shared.latest_moves.append(state.user_input.move)


class SelectNegativeUnderstandingICM(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        return state.user_input and state.user_input.move is None

    @staticmethod
    def effects(state: DialogState):
        state.next_system_move = ICM(level=understanding, polarity=negative)


class GetAnswer(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.plan) > 0 and isinstance(state.private.plan[0], Respond):
            plan_item = state.private.plan[0]
            question = plan_item.question
            belief = get_answer(question, state.private.beliefs, state.domain)
            if belief and belief not in state.private.beliefs:
                return belief,

    @staticmethod
    def effects(state: DialogState, belief: Belief):
        logger.info('add answer to private beliefs', question=state.private.plan[0].question, belief=belief)
        state.private.beliefs.append(belief)


class SelectAssert(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.plan) > 0 and isinstance(state.private.plan[0], Respond):
            plan_item = state.private.plan[0]
            question = plan_item.question
            for belief in state.private.beliefs:
                if is_relevant_answer(question, belief.proposition, state.domain):
                    return belief,

    @staticmethod
    def effects(state: DialogState, belief: Belief):
        state.private.plan.pop(0)
        state.next_system_move = select_answer_move(belief, state)


class RejectUnanswerableQuestion(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.plan) > 0 and isinstance(state.private.plan[0], Respond):
            plan_item = state.private.plan[0]
            question = plan_item.question
            return get_answer(question, state.private.beliefs, state.domain) is None

    @staticmethod
    def effects(state: DialogState):
        state.private.plan.pop(0)
        state.next_system_move = ICM(level=acceptance, polarity=negative, reason=LackKnowledge())


class IntegrateUserAsk(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.non_integrated_moves) > 0:
            move = state.private.non_integrated_moves[0]
            if isinstance(move, Ask):
                if isinstance(move.question, Why) and move.question.explanandum:
                    return is_compatible_with_beliefs(move.question.explanandum, state.private.beliefs, state.domain)
                else:
                    return True

    @staticmethod
    def effects(state: DialogState):
        move = state.private.non_integrated_moves.pop(0)
        assert isinstance(move, Ask)
        resolved_question = resolve_elliptical_question(move.question, state) if is_elliptical_question(move.question) \
            else move.question
        state.shared.qud.insert(0, resolved_question)
        state.private.plan.insert(0, Respond(resolved_question))


class IntegrateUserNegativeUnderstanding(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.non_integrated_moves) > 0:
            move = state.private.non_integrated_moves[0]
            return isinstance(move, ICM) and move.level == understanding and move.polarity == negative

    @staticmethod
    def effects(state: DialogState):
        state.private.non_integrated_moves.pop(0)
        if len(state.shared.qud) > 0 and isinstance(state.previous_system_move, Assert):
            topmost_qud = state.shared.qud[0]
            if isinstance(topmost_qud, Why):
                resolved_question = Why(Explains(state.previous_system_move.proposition, topmost_qud.explanandum))
                state.shared.qud.insert(0, resolved_question)
                state.private.plan.insert(0, Respond(resolved_question))


class AcknowledgeUserAssertion(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.non_integrated_moves) > 0:
            move = state.private.non_integrated_moves[0]
            return isinstance(move, Assert)

    @staticmethod
    def effects(state: DialogState):
        state.private.non_integrated_moves.pop(0)
        state.next_system_move = ICM(acceptance, positive)


class RejectQuestionWithIncompatiblePresupposition(Rule):
    @staticmethod
    def preconditions(state: DialogState):
        if len(state.private.non_integrated_moves) > 0:
            move = state.private.non_integrated_moves[0]
            if isinstance(move, Ask):
                if isinstance(move.question, Why) and move.question.explanandum is not None:
                    return not is_compatible_with_beliefs(
                        move.question.explanandum, state.private.beliefs, state.domain)

    @staticmethod
    def effects(state: DialogState):
        move = state.private.non_integrated_moves.pop(0)
        assert isinstance(move, Ask)
        assert isinstance(move.question, Why)
        state.next_system_move = ICM(
            level=acceptance, polarity=negative, reason=move.question.explanandum)


def try_rule(state: DialogState, rule):
    logger.debug('try_rule', rule=rule)
    result = rule.preconditions(state)
    if result:
        logger.info('preconditions true')
        try:
            bound_variables = list(result)
        except TypeError:
            bound_variables = None
        if bound_variables:
            rule.effects(state, *bound_variables)
        else:
            rule.effects(state)


def update_and_select(state: DialogState):
    logger.info('update_and_select', user_input=state.user_input)
    try_rule(state, GetLatestMoves)
    try_rule(state, SelectNegativeUnderstandingICM)
    try_rule(state, IntegrateUserAsk)
    try_rule(state, IntegrateUserNegativeUnderstanding)
    try_rule(state, AcknowledgeUserAssertion)
    try_rule(state, RejectQuestionWithIncompatiblePresupposition)
    try_rule(state, RejectUnanswerableQuestion)
    try_rule(state, GetAnswer)
    try_rule(state, SelectAssert)
