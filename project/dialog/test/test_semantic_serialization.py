import pytest

from dialog.ontology import *
from dialog.semantic_serialization import deserialize



instances = [
    ('Why()', Why()),
    ('Ask(Why())', Ask(Why())),
    ("ICM(understanding, negative)", ICM(understanding, negative)),
]


class TestSemanticSerialization:
    @pytest.mark.parametrize('string,object', instances)
    def test_deserialize(self, string, object):
        actual = deserialize(string)
        assert actual == object
