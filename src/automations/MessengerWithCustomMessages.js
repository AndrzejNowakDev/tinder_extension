import get from 'lodash/get';
import keyBy from 'lodash/keyBy';
import { sendMessageToMatch, getMessagesForMatch, getMatches } from '../misc/api';
import { randomDelay, logger } from '../misc/helper';
import { getCheckboxValue, toggleCheckbox } from '../views/Sidebar';

class MessengerWithCustomMessages {
  selector = '.tinderAutopilotMessages';

  newSelector = '.tinderAutopilotMessageNewOnly';

  nextPageToken;

  isRunningMessage;

  allMatches = [];

  checkedMessage = 0;

  messagesToSend = [];

  loopMatches = async () => {
    const response = await getMatches(getCheckboxValue(this.newSelector), this.nextPageToken);
    this.nextPageToken = get(response, 'data.next_page_token');
    this.allMatches.push.apply(this.allMatches, get(response, 'data.matches', []));
  };

  start = () => {
    this.checkedMessage = 0;
    logger('Starting messages');
    this.isRunningMessage = true;
    this.nextPageToken = true;
    this.runMessage();
  };

  stop = () => {
    setTimeout(() => {
      logger('Messaging stopped ⛔️');
      this.isRunningMessage = false;
      toggleCheckbox(this.selector);
    }, 500);
  };

  runMessage = async () => {
    await this.loopMatches();
    while (this.nextPageToken) {
      logger(`Currently have ${this.allMatches.length} matches`);
      await this.loopMatches();
    }

    logger(`Retrieved all match history: ${this.allMatches.length}`);
    this.messagesToSend = this.generateMessagesArray();
    logger(`Looking for matches we have not sent yet to`);
    this.sendMessagesTo(this.allMatches.reverse());
  };

  generateMessagesArray = () => {
    const messages = [];
    for (let i = 1; i <= 10; i++) {
      const message = get(document.getElementById(`messageToSend${i}`), 'value', '').trim();
      if (message !== '') {
        messages.push(message);
      }
    }
    return messages.length > 0 && messages;
  };

  sendMessagesTo = async (r) => {
    const matchList = keyBy(r, 'id');
    const pendingPromiseList = [];

    for (const matchID of Object.keys(matchList)) {
      await randomDelay();
      if (!this.isRunningMessage) break;

      const match = matchList[matchID];
      const messageIndex = Math.floor(Math.random() * this.messagesToSend.length);
      const messageToSend = this.messagesToSend[messageIndex].replace(
        '{name}',
        get(match, 'person.name').toLowerCase()
      );

      const messageToSendL = messageToSend
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace('thanks', 'thank');

      pendingPromiseList.push(
        getMessagesForMatch(match.id)
          .then((messageList) => {
            this.checkedMessage += 1;
            logger(`Checked ${this.checkedMessage}/${this.allMatches.length}`);
            return messageList ? !messageList.includes(messageToSendL) : false;
          })
          .then((shouldSend) => {
            if (shouldSend) {
              sendMessageToMatch(match.id, { message: messageToSend }).then((b) => {
                if (get(b, 'sent_date')) {
                  logger(`Message sent to ${get(match, 'person.name')}`);
                }
              });
            }
          })
      );
    }

    if (pendingPromiseList.length === 0) {
      logger('No more matches to send message to');
      this.stop();
    } else {
      Promise.all(pendingPromiseList).then((r) => {
        logger('No more matches to send message to');
        this.stop();
      });
    }
  };
}

export default MessengerWithCustomMessages;
