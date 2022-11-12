import Voice from '@react-native-voice/voice';
import React, {Component} from 'react';
import Tts from 'react-native-tts';
import RNShake from 'react-native-shake';
import {es} from './i18n/es';

const LANGUAGE = 'es-ES';
const LANGUAGE_RECOGNITION = 'es-AR';

Tts.setDefaultLanguage(LANGUAGE_RECOGNITION);
Tts.setDefaultRate(0.45);
Tts.voices();
class BlindMenuComponent extends Component {
  state = {
    hasFinished: false,
    currentMenuStep: 0,
  };
  constructor(props) {
    super(props);
    this.menuActivated = React.createRef();
    this.menuActivated.current = false;
    this.rnShakeRef = React.createRef();
    Voice.removeAllListeners();
    Voice.onSpeechResults = undefined;

    this.activateMenu = this.activateMenu.bind(this);
    this.listTextListener = Tts.addEventListener('tts-finish', () => {
      if (this.state.actionAtFinish) this.state.actionAtFinish();
      this.setState({hasFinished: true, actionAtFinish: undefined});
    });

    if (props.options) {
      const options = props.options.map(this.transformOption);
      this.state = {...this.state, options};
    }
  }

  transformOption = op => {
    return {
      text: op.text,
      type: op.type,
      action: async () => {
        this.setState({
          isConfirmation: false,
          hasFinished: true,
          actionAtFinish: undefined,
        });
        this.menuActivated.current = false;
        const onFinishAction = () => {
          Tts.speak(es.commands.confirmationMSG);
        };
        op.onAccept(onFinishAction, this.state.topic);
      },
    };
  };

  componentDidMount() {
    setTimeout(() => {
      this.addShakeListener();
    }, 1000);
  }

  addShakeListener() {
    this.rnShakeRef.current = RNShake.addListener(() => {
      if (this.props.onMenuOpen) this.props.onMenuOpen();
      if (this.menuActivated.current) {
        Tts.speak(es.commands.closeMenu);
        if (this.props.onMenuClose) this.props.onMenuClose();
        this.cleanState();
      } else {
        this.activateMenu();
      }
    });
  }

  removeShakeListener() {
    if (this.rnShakeRef.current) this.rnShakeRef.current.remove();
  }

  cleanState = async () => {
    this.setState({
      topic: undefined,
      blockListener: true,
      isAddTopic: false,
      isConfirmation: false,
    });
    this.menuActivated.current = false;
  };

  handleFill = e => {
    if (e.value && e.value[0]?.toLowerCase().includes(es.commands.end)) {
      Voice.stop();
      const topic = e.value[0]?.toLowerCase().replace(es.commands.end, '');
      this.setState({
        topic,
        actionAtFinish: this.startListen,
        blockListener: true,
        isConfirmation: true,
        hasFinished: false,
      });
      Tts.speak(`Ha dicho ${topic}. ¿Es correcto? Diga si o No`);
    }
  };

  confirmation = (e, onYes, onNo) => {
    if (e.value && e.value[0]?.toLowerCase().includes(es.confirmation.yes)) {
      Voice.stop();
      onYes();
    } else if (e.value[0]?.toLowerCase().includes(es.confirmation.no)) {
      Voice.stop();
      onNo();
    }
  };

  applyFill() {
    this.setState({isConfirmation: false});
    Tts.speak(es.accessibility.endMethod);

    this.setState({actionAtFinish: this.startListen});
  }
  handleMenuConfiguration = e => {
    const onYes = () => {
      this.setState({isConfirmation: false});
      if (
        this.state.options[this.state.currentMenuStep].type ===
        es.commands.types.yesOrNo
      ) {
        Tts.speak(`Ejecutando accion, por favor espere`);
        setTimeout(() => {
          this.state.action();
        }, 3000);
      } else {
        if (
          this.state.options[this.state.currentMenuStep].type ===
            es.commands.types.fillInput &&
          !this.state.topic
        ) {
          this.applyFill();
        } else
          setTimeout(() => {
            this.state.action();
          }, 1000);
      }
    };
    const onNo = () => {
      if (
        this.state.options[this.state.currentMenuStep].type ===
          es.commands.types.fillInput &&
        this.state.topic
      ) {
        this.applyFill();
        return;
      }

      this.setState({isConfirmation: false});

      if (this.state.currentMenuStep + 1 === this.state.options.length) {
        Tts.speak(es.accessibility.noOptions);
        if (this.props.onMenuClose) this.props.onMenuClose();

        this.cleanState();
        this.setState({currentMenuStep: 0, action: 0, isConfirmation: false});
        return;
      }
      setTimeout(() => {
        this.setState(
          {
            currentMenuStep: this.state.currentMenuStep + 1,
            action: () => {},
          },
          () => {
            this.reproduceMenu();
          },
        );
      }, 1000);
    };
    this.confirmation(e, onYes, onNo);
  };

  handleOnSpeechResult = e => {
    if (this.state.blockListener) return;
    if (this.state.isConfirmation) this.handleMenuConfiguration(e);
    else if (
      this.state.options[this.state.currentMenuStep].type ===
      es.commands.types.fillInput
    ) {
      this.handleFill(e);
    }
  };

  onSpeechResultsHandler = e => {
    this.handleOnSpeechResult(e);
  };

  startListen = async () => {
    Voice.onSpeechResults = this.onSpeechResultsHandler;
    this.setState({blockListener: false}, () => {
      Voice.start(LANGUAGE);
    });
  };

  componentWillUnmount() {
    Voice.stop();
    Voice.destroy();
    Tts.removeEventListener('tts-finish', this.listTextListener);
    this.removeShakeListener();
    if (this.props.onMenuClose) this.props.onMenuClose();
  }

  reproduceMenu = () => {
    Tts.speak(
      `${this.state.options[this.state.currentMenuStep].text}. ${
        es.commands.confirmation
      }`,
    );
    this.setState({
      action: this.state.options[this.state.currentMenuStep].action,
      isConfirmation: true,
      actionAtFinish: this.startListen,
    });
    this.menuActivated.current = true;
  };

  activateMenu = () => {
    const actionAtFinish = () => {
      setTimeout(() => {
        this.reproduceMenu();
      }, 500);
    };
    this.setState({actionAtFinish});
    Tts.speak(es.commands.action);
  };

  render() {
    return this.props.children;
  }
}

const BlindMenuComponentWrapper = params => {

  if (!params.isFocused) return params.children;
  return <BlindMenuComponent {...params} removeListener={!params.isFocused} />;
};

export default BlindMenuComponentWrapper;
