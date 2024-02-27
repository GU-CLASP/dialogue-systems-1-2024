from dialog.ontology import DialogState


class Rule:
    @staticmethod
    def preconditions(state: DialogState):
        raise NotImplemented()

    @staticmethod
    def effects(state: DialogState):
        raise NotImplemented()
