from unittest.mock import MagicMock
import yaml

import pytest

from dialog import bot
import dialog.music_personality.domain
import dialog.music_personality.nlu_simple
import dialog.music_personality.nlg
from dialog.test.dialogtest import run_dialog_test_nl


test_contents = yaml.load(open('dialog/music_personality/test/dialog_coverage_nl.yml').read(), yaml.Loader)


class TestDialogs(object):
    @pytest.mark.parametrize('name,content', test_contents.items())
    def test_dialog(self, name, content):
        resources = {
            'domain_class': dialog.music_personality.domain.MusicPersonalityDomain,
            'nlu': dialog.music_personality.nlu_simple,
            'nlg': dialog.music_personality.nlg,
        }
        resources['extraversion_model_bundle'] = {
            'model': MagicMock(),
            'scaler': MagicMock(),
        }
        resources['explainer'] = MagicMock()
        session_data = {'case_info': {}}
        if 'feature_values' in content:
            session_data['case_info']['feature_values'] = content['feature_values']
            resources['extraversion_model_bundle']['features'] = content['feature_values'].keys()
        if 'predicted_extraversion_prob' in content:
            p = content['predicted_extraversion_prob']
            resources['extraversion_model_bundle']['model'].predict_proba.return_value = [[p, 1 - p]]
        if 'global_coefficients' in content:
            resources['explainer'].global_coefficients.return_value = content['global_coefficients']
        if 'local_contributions' in content:
            resources['explainer'].local_contributions.return_value = content['local_contributions']
        run_dialog_test_nl(bot, resources, content['turns'], session_data)
