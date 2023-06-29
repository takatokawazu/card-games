import Phaser from 'phaser'
import BaseScene from '../common/BaseScene'
import Button from '../common/button'
import GameResult from './constants/gameResult'
import GameStatus from './constants/gameStatus'
import { HAND_RANK, HAND_RANK_MAP, RANK_CHOICES } from './constants/handRank'
import PlayerAction from './constants/playAction'
import Text = Phaser.GameObjects.Text
import Zone = Phaser.GameObjects.Zone
import { CARD_HEIGHT, CARD_WIDTH } from '@/Factories/cardFactory'
import Card from '@/model/common/CardImage'
import Deck from '@/model/common/DeckImage'
import { Result } from '@/model/common/types/game'
import PokerPlayer from '@/model/poker/PokerPlayer'
import Pot from '@/model/poker/Pot'
import { textStyle, GUTTER_SIZE } from '@/utility/constants'

const ANTE_AMOUNT = 20

export default class Poker extends BaseScene {
  protected playerHandZones: Array<Zone> = []

  protected playerNameTexts: Array<Text> = []

  private pot: Pot | undefined

  private raiseButton: Button | undefined

  private callButton: Button | undefined

  private foldButton: Button | undefined

  private checkButton: Button | undefined

  private changeHandButton: Button | undefined

  private player: PokerPlayer

  private playerDeck: Deck | undefined

  protected playerHandZone: Zone | undefined

  protected cpuHandZone: Zone | undefined

  private playerMoney: number = 1000

  protected players: Array<PokerPlayer> = []

  private playerBet: number = 0

  private currentBetAmount: number = 0

  private cpuBettingStatus: Text | undefined

  public width: number = 1024

  public height: number = 768

  constructor() {
    super({ key: 'Poker', active: false })

    this.players = [
      new PokerPlayer('PLAYER', 'player', GameStatus.FIRST_BETTING),
      new PokerPlayer('CPU', 'cpu', GameStatus.FIRST_BETTING),
    ]
    this.player = this.players[0] as PokerPlayer
  }

  create(): void {
    super.createField()
    this.createPot()
    this.setUpNewGame()
    this.setUpMoneyText()
    this.createPlayerNameTexts()
    this.createPlayerHandZones(CARD_WIDTH, CARD_HEIGHT)
    this.dealInitialCards()
    this.time.delayedCall(2000, () => {
      this.PlayAnte()
      this.createActionPanel()
    })
  }

  private setUpNewGame() {
    this.playerDeck = new Deck(this, this.width / 2, -140, 'poker')
  }

  private createActionPanel(): void {
    this.createRaiseButton()

    if (this.currentBetAmount === 0) {
      this.createCheckButton()
    } else this.createCallButton()

    this.createFoldButton()
  }

  private createFoldButton(): void {
    this.foldButton = new Button(this, this.width * 0.85, this.height * 0.9, 'chipBlue', 'FOLD')

    this.foldButton.setClickHandler(() => {
      this.player.gameStatus = PlayerAction.FOLD
      this.players.forEach((player) => {
        player.hand.forEach((card) => {
          card.playMoveTween(this.width / 2, -600)
        })
      })
      this.nextPlayerTurnOnFirstBettingRound(1)
    })
  }

  private createCallButton(): void {
    this.callButton = new Button(this, this.width * 0.85, this.height * 0.8, 'chipBlue', 'CALL')

    this.callButton.setClickHandler(() => {
      this.playerBet += this.currentBetAmount
      this.playerMoney -= this.playerBet
      this.player.gameStatus = PlayerAction.CALL

      // TODO: チップアニメーション追加
      this.time.delayedCall(500, () => {
        this.updateMText(this.playerMoney)
        this.updateBText(this.playerBet)
        this.pot?.setAmount(this.currentBetAmount)
        this.destroyActionPanel()

        this.nextPlayerTurnOnFirstBettingRound(1)
      })
    })
  }

  payOut(result: GameResult): Result {
    let winAmount = 0
    if (result === GameResult.WIN) {
      winAmount = this.pot?.getAmount() as number
    } else if (result === GameResult.TIE) {
      winAmount = (this.pot?.getAmount() as number) / 2
    } else if (result === GameResult.LOSS) {
      winAmount = -this.playerBet
      this.playerMoney -= this.playerBet
    }
    this.playerMoney += winAmount
    this.updateMText(this.playerMoney)

    return {
      gameResult: result,
      winAmount,
    }
  }

  private compareAllHands(): PokerPlayer[] {
    const players = (this.players as PokerPlayer[]).filter(
      (player) => player.gameStatus !== PlayerAction.FOLD,
    )
    const sortedPlayers = players.sort((a, b) => {
      const aRank = a.getHandRank()
      const bRank = b.getHandRank()
      if (aRank > bRank) {
        return -1
      }
      if (aRank < bRank) {
        return 1
      }
      const aHighCard = a.getHandRank()
      const bHighCard = b.getHandRank()

      if (aHighCard > bHighCard) {
        return -1
      }
      if (aHighCard < bHighCard) {
        return 1
      }
      return 0
    })

    const maxRank = sortedPlayers[0].getHandRank()
    const winners = sortedPlayers.filter((player) => player.getHandRank() === maxRank)
    return winners
  }

  private isSecondBettingEnd(): boolean {
    let isEnd = true
    this.players.forEach((player) => {
      if (player.gameStatus === GameStatus.SECOND_BETTING) {
        isEnd = false
        return isEnd
      }

      if (player.gameStatus === PlayerAction.CHECK) {
        if (player.bet === 0) {
          isEnd = false
        }
      }

      if (player.gameStatus === PlayerAction.CALL) {
        isEnd = player.bet === this.currentBetAmount
      }

      if (player.gameStatus === PlayerAction.RAISE) {
        if (player.bet !== 0 && player.bet === this.currentBetAmount) {
          isEnd = true
        } else {
          isEnd = false
        }
      }
      return isEnd
    })

    return isEnd
  }

  private isFirstBettingEnd(): boolean {
    let isEnd = true
    // eslint-disable-next-line consistent-return
    this.players.forEach((player) => {
      if (player.gameStatus === GameStatus.FIRST_BETTING) {
        isEnd = false
      }

      if (player.gameStatus === PlayerAction.CHECK) {
        if (player.bet === 0) {
          isEnd = false
        }
      }

      if (player.gameStatus === PlayerAction.CALL) {
        isEnd = player.bet === this.currentBetAmount
      }

      if (player.gameStatus === PlayerAction.RAISE) {
        if (player.bet !== 0 && player.bet === this.currentBetAmount) {
          isEnd = true
        } else {
          isEnd = false
        }
      }
    })
    return isEnd
  }

  private noContest(result: GameResult): void {
    this.destroyActionPanel()
    this.payOut(result)
    const noContestText = this.add
      .text(this.width / 2, this.height / 2, result, textStyle)
      .setOrigin(0.5)
      .setDepth(10)

    // 初期化
    this.resetRound()

    this.time.delayedCall(3000, () => {
      noContestText.destroy()
      this.players.forEach((player) => {
        // eslint-disable-next-line no-param-reassign
        player.hand = []
      })
      this.dealInitialCards()
      this.PlayAnte()
    })

    this.time.delayedCall(4000, () => {
      this.createActionPanel()
    })
  }

  private hasEnoughPlayers(): boolean {
    return this.players.filter((player) => player.gameStatus !== PlayerAction.FOLD).length >= 2
  }

  private clearPlayersBet(): void {
    this.players.forEach((player) => {
      player.clearBet()
    })
  }

  private destroyActionPanel(): void {
    this.raiseButton?.destroy()
    this.callButton?.destroy()
    this.checkButton?.destroy()
    this.foldButton?.destroy()
  }

  private isChangeHandRoundEnd(): boolean {
    let isEnd = true
    this.players.forEach((player) => {
      if (player.gameStatus === GameStatus.CHANGE_CARD) {
        isEnd = false
      }
    })
    return isEnd
  }

  private createRaiseButton(): void {
    this.raiseButton = new Button(this, this.width * 0.85, this.height * 0.7, 'chipBlue', 'RAISE')

    this.raiseButton.setClickHandler(() => {
      this.addRaiseAmount()
      this.playerBet += this.currentBetAmount
      this.playerMoney -= this.playerBet
      this.player.addBet(this.currentBetAmount)
      this.animateChipToTableCenter(0)

      this.time.delayedCall(500, () => {
        this.updateMText(this.playerMoney)
        this.updateBText(this.playerBet)
        this.pot?.setAmount(this.currentBetAmount)
        this.destroyActionPanel()
        if (this.player.gameStatus === GameStatus.SECOND_BETTING) {
          this.nextPlayerTurnOnSecondBettingRound(1)
        } else {
          this.nextPlayerTurnOnFirstBettingRound(1)
        }
        this.player.gameStatus = PlayerAction.RAISE
      })
    })
  }

  private createCheckButton(): void {
    this.checkButton = new Button(this, this.width * 0.85, this.height * 0.8, 'chipBlue', 'CHECK')

    this.checkButton.setClickHandler(() => {
      // TODO: チップアニメーション追加
      this.time.delayedCall(500, () => {
        this.destroyActionPanel()
        if (this.player.gameStatus === GameStatus.SECOND_BETTING) {
          this.player.gameStatus = PlayerAction.CHECK
          this.nextPlayerTurnOnSecondBettingRound(1)
        } else {
          this.player.gameStatus = PlayerAction.CHECK
          this.nextPlayerTurnOnFirstBettingRound(1)
        }
      })
    })
  }

  private addRaiseAmount(): void {
    const raiseAmount = this.currentBetAmount + 100
    this.currentBetAmount = raiseAmount
  }

  private createPot(): void {
    this.pot = new Pot(this, this.width / 2, this.height / 2, 'chipRed', 0)
  }

  private PlayAnte(): void {
    this.players.forEach((player, index) => {
      if (player.playerType === 'player') {
        this.playerMoney -= ANTE_AMOUNT
        this.playerBet += ANTE_AMOUNT
        this.updateMText(this.playerMoney)
        this.updateBText(this.playerBet)
      }

      this.time.delayedCall(1500, () => {
        this.animateChipToTableCenter(index)
        this.pot?.setAmount(ANTE_AMOUNT)
      })
    })
  }

  public setUpMoneyText(): void {
    this.moneyText = this.add.text(0, 0, '', textStyle)
    this.betText = this.add.text(0, 0, '', textStyle)
  }

  public updateMText(money: number): void {
    ;(this.moneyText as Text).setText(`Money: $${money}`)
    Phaser.Display.Align.In.TopRight(this.moneyText as Text, this.gameZone as Zone, -20, -20)
  }

  public updateBText(bet: number) {
    ;(this.betText as Text).setText(`Bet: $${bet}`)
    Phaser.Display.Align.To.BottomLeft(this.betText as Text, this.moneyText as Text)
  }

  private animateChipToTableCenter(index: number) {
    const tempChip = new Button(
      this,
      this.playerHandZones[index].x,
      this.playerHandZones[index].y,
      'chipRed',
    )
    tempChip.resizeButton(0.6)

    tempChip.playMoveAndDestroy(this.width / 2, this.height / 2)
  }

  private dealInitialCards(): void {
    this.time.delayedCall(500, () => {
      this.players.forEach((player, index) => {
        if (player.playerType === 'player') {
          for (let i = 0; i < 5; i += 1) {
            this.handOutCard(
              this.playerDeck as Deck,
              player as PokerPlayer,
              this.playerHandZones[index].x - (CARD_WIDTH + 10) * 2 + i * (CARD_WIDTH + 10),
              this.playerHandZones[index].y,
              true,
            )
          }
        } else if (player.playerType === 'cpu') {
          for (let i = 0; i < 5; i += 1) {
            this.handOutCard(
              this.playerDeck as Deck,
              player as PokerPlayer,
              this.playerHandZones[index].x - (CARD_WIDTH + 10) * 2 + i * (CARD_WIDTH + 10),
              this.playerHandZones[index].y,
              true,
            )
          }
        }
      })
    })

    this.time.delayedCall(1500, () => {
      this.player.hand.forEach((card) => {
        if (card.getFaceDown()) {
          card.playFlipOverTween()
        }
      })
    })
  }

  private handOutCard(
    deck: Deck,
    player: PokerPlayer,
    toX: number,
    toY: number,
    isFaceDown: boolean,
  ): void {
    const card: Card | undefined = deck.drawOne()
    if (card) {
      if (!isFaceDown) {
        card.setFaceUp()
      }
      player.addHand(card)
      this.children.bringToTop(card)
      card.playMoveTween(toX, toY)
    }
  }

  protected createPlayerHandZones(width: number, height: number): void {
    this.playerHandZones = []
    this.players.forEach((player, index) => {
      const playerHandZone = this.add.zone(0, 0, width, height)
      if (player.playerType === 'player') {
        Phaser.Display.Align.To.TopCenter(
          playerHandZone as Zone,
          this.playerNameTexts[index] as Text,
          0,
          GUTTER_SIZE,
        )
      } else if (player.playerType === 'cpu') {
        Phaser.Display.Align.To.BottomCenter(
          playerHandZone as Zone,
          this.playerNameTexts[index] as Text,
          0,
          GUTTER_SIZE,
        )
      }
      // aiが存在する場合は、個別に位置の設定が必要。
      this.playerHandZones.push(playerHandZone)
    })
  }

  protected createPlayerNameTexts(): void {
    this.playerNameTexts = [] // 前回のゲームで作成したものが残っている可能性があるので、初期化する
    this.players.forEach((player) => {
      const playerNameText = this.add.text(0, 300, player.name, textStyle)
      if (player.playerType === 'player') {
        Phaser.Display.Align.In.BottomCenter(playerNameText as Text, this.gameZone as Zone, 0, -20)
      } else if (player.playerType === 'cpu') {
        Phaser.Display.Align.In.TopCenter(playerNameText as Text, this.gameZone as Zone, 0, -20)
      }
      // aiが存在する場合は、個別に位置の設定が必要。
      this.playerNameTexts.push(playerNameText)
    })
  }

  private nextPlayerTurnOnFirstBettingRound(playerIndex: number): void {
    if (!this.hasEnoughPlayers()) {
      this.clearPlayersBet()
      this.cpuBettingStatus?.destroy()
      if (this.player.gameStatus === PlayerAction.FOLD) {
        this.noContest(GameResult.LOSS)
        return
      }
      this.noContest(GameResult.WIN)
      return
    }

    // ハンド交換へ
    if (this.isFirstBettingEnd()) {
      this.clearPlayersBet()
      this.cpuBettingStatus?.destroy()

      // 全員のstatus変更
      this.players.forEach((player) => {
        // eslint-disable-next-line no-param-reassign
        player.gameStatus = GameStatus.CHANGE_CARD
      })
      this.nextPlayerTurnOnChangeHandRound(0)

      return
    }

    let currentPlayerIndex = playerIndex
    if (playerIndex > this.players.length - 1) currentPlayerIndex = 0

    if (this.players[currentPlayerIndex].playerType === 'player') {
      this.createActionPanel()
    } else {
      this.cpuFirstBettingAction(1)
    }
  }

  private cpuFirstBettingAction(index: number): void {
    const decisionValues = Object.values(PlayerAction)
    const decisionIndex = Math.floor(Math.random() * decisionValues.length)
    let decisionValue = decisionValues[decisionIndex]
    if (this.currentBetAmount !== 0 && decisionValue === PlayerAction.CHECK) {
      decisionValue = PlayerAction.CALL
    }

    decisionValue = PlayerAction.CALL

    if (decisionValue === PlayerAction.CALL) {
      const betAmount = this.currentBetAmount - this.players[index].bet
      this.players[index].addBet(betAmount)
      this.players[index].gameStatus = PlayerAction.CALL

      this.time.delayedCall(1000, () => {
        this.createCpuBettingStatus(PlayerAction.CALL)
        this.animateChipToTableCenter(index)
        this.pot?.setAmount(betAmount)
      })
    }

    this.time.delayedCall(2500, () => {
      this.nextPlayerTurnOnFirstBettingRound(0)
    })
  }

  private createCpuBettingStatus(status: string): void {
    let tmpStr = ''
    if (status === PlayerAction.RAISE) tmpStr = `RAISE: ${this.currentBetAmount}`
    else if (status === PlayerAction.CALL) tmpStr = `CALL: ${this.currentBetAmount}`
    else if (status === PlayerAction.CHECK) tmpStr = `CHECK: ${this.currentBetAmount}`
    else tmpStr = `FOLD`

    this.cpuBettingStatus = this.add
      .text(this.playerHandZones[1].x, this.playerHandZones[1].y, tmpStr, textStyle)
      .setOrigin(0.5)
      .setDepth(10)
  }

  private nextPlayerTurnOnChangeHandRound(playerIndex: number): void {
    let currentPlayerIndex = playerIndex
    if (playerIndex > this.players.length - 1) currentPlayerIndex = 0

    // 2巡目へ
    if (this.isChangeHandRoundEnd()) {
      this.currentBetAmount = 0
      this.clearPlayersBet()
      this.nextPlayerTurnOnSecondBettingRound(0)
      return
    }

    if (this.players[currentPlayerIndex].playerType === 'player') {
      // カード交換処理
      this.createChageHandButton()
      this.enableHandSelection()
    } else {
      this.cpuChangeHand(1)
    }
  }

  private cpuChangeHand(playerIndex: number): void {
    const selectedCards: Card[] = []
    this.players[1].gameStatus = GameStatus.SECOND_BETTING
    const handStrength = this.players[playerIndex].getHandRank()
    const ranks = this.players[playerIndex].getRanks()
    const playerHand = this.players[playerIndex].hand

    this.players[playerIndex].hand.forEach((card) => {
      if (Poker.shouldDiscardCard(card, handStrength, ranks, playerHand)) {
        selectedCards.push(card)
      }
    })

    if (selectedCards.length === 0) return

    selectedCards.forEach((card) => {
      this.players[playerIndex].removeCardFromHand(card)
      card.setOriginalPosition()
      card.playMoveTween(this.width / 2, -600)
    })

    this.time.delayedCall(500, () => {
      selectedCards.forEach((card) => {
        this.handOutCard(
          this.playerDeck as Deck,
          this.players[playerIndex] as PokerPlayer,
          card.originalPositionX as number,
          card.originalPositionY as number,
          true,
        )
      })

      this.nextPlayerTurnOnChangeHandRound(0)
    })
  }

  private static shouldDiscardCard(
    card: Card,
    handRank: number,
    ranks: number[],
    hand: Card[],
  ): boolean {
    // 5枚で, スコアの高い役がすでにできている場合は交換しない
    if (handRank === HAND_RANK_MAP.get(HAND_RANK.ROYAL_STRAIGHT_FLUSH)) {
      return false
    }

    if (handRank === HAND_RANK_MAP.get(HAND_RANK.STRAIGHT_FLUSH)) {
      return false
    }

    if (handRank === HAND_RANK_MAP.get(HAND_RANK.FULL_HOUSE)) {
      return false
    }

    if (handRank === HAND_RANK_MAP.get(HAND_RANK.FLUSH)) {
      return false
    }

    if (handRank === HAND_RANK_MAP.get(HAND_RANK.STRAIGHT)) {
      return false
    }

    // ペアやスリーオブアカインド等が既に存在する場合にはそれらを構成するカードを保持
    const cardRank = RANK_CHOICES.indexOf(card.rank)
    const count = ranks.filter((rank) => rank === cardRank).length
    if (count >= 2) {
      return false
    }

    // フラッシュにあと一枚でなる場合, フラッシュになっている4枚に含まれているかをチェックする
    if (Poker.isCardPartOfFlush(card, hand)) {
      return false
    }

    // あと一枚でストレートになる場合, ストレートになっている4枚に含まれるかどうかをチェックする
    if (Poker.isCardPartOfStraight(cardRank, ranks)) {
      return false
    }

    // 役がなにもない場合, もしくはワンペアの場合は, 高ランクカードは保持
    if (
      (handRank === HAND_RANK_MAP.get(HAND_RANK.FULL_HOUSE) ||
        handRank === HAND_RANK_MAP.get(HAND_RANK.ONE_PAIR)) &&
      (card.rank === 'A' || card.rank === 'K' || card.rank === 'Q')
    ) {
      return false
    }

    return true
  }

  private static isCardPartOfFlush({ suit: cardSuit }: Card, hand: Card[]): boolean {
    const suitCountMap = { [cardSuit]: 1 }

    hand.forEach(({ suit }) => {
      if (suit !== cardSuit) {
        if (suitCountMap[suit]) {
          suitCountMap[suit] += 1
        } else {
          suitCountMap[suit] = 1
        }
      }
    })

    return Object.keys(suitCountMap).some((suit) => suitCountMap[suit] >= 4 && suit === cardSuit)
    return false
  }

  private static isCardPartOfStraight(cardRank: number, ranks: number[]): boolean {
    const sortedRanks = [...ranks].sort((a, b) => a - b)
    const cardRankSortedIndex = sortedRanks.indexOf(cardRank)
    if (sortedRanks[3] - sortedRanks[0] === 3) {
      if (
        cardRankSortedIndex >= 3 &&
        sortedRanks[cardRankSortedIndex] - sortedRanks[cardRankSortedIndex - 1] === 1
      ) {
        return true
      }
      if (sortedRanks[cardRankSortedIndex + 1] - sortedRanks[cardRankSortedIndex] === 1) {
        return true
      }
    }

    if (sortedRanks[4] - sortedRanks[1] === 3) {
      if (
        cardRankSortedIndex <= 2 &&
        sortedRanks[cardRankSortedIndex + 1] - sortedRanks[cardRankSortedIndex] === 1
      ) {
        return true
      }
      if (sortedRanks[cardRankSortedIndex] - sortedRanks[cardRankSortedIndex - 1] === 1) {
        return true
      }
    }
    return false
  }

  private enableHandSelection(): void {
    this.player.hand.forEach((card) => {
      card.enableClick()
    })
  }

  private createChageHandButton(): void {
    this.changeHandButton = new Button(
      this,
      this.width * 0.1,
      this.height * 0.9,
      'chipBlue',
      'CHANGE',
    )

    // カード交換処理
    this.changeHandButton.setClickHandler(() => {
      this.disableHandSelection()
      this.changeHandButton?.destroy()
      this.player.gameStatus = GameStatus.SECOND_BETTING

      const selectedCards: Card[] = []
      this.player.hand.forEach((card) => {
        if (card.isMoveUp()) {
          card.playMoveTween(this.width / 2, -140)
          selectedCards.push(card)
        }
      })

      selectedCards.forEach((card) => {
        this.player.removeCardFromHand(card)
      })

      this.time.delayedCall(500, () => {
        selectedCards.forEach((card) => {
          this.handOutCard(
            this.playerDeck as Deck,
            this.player as PokerPlayer,
            card.originalPositionX as number,
            card.originalPositionY as number,
            true,
          )
        })
      })

      this.time.delayedCall(1500, () => {
        this.player.hand.forEach((card) => {
          if (card.faceDown) {
            card.playFlipOverTween()
          }
        })
        this.nextPlayerTurnOnChangeHandRound(1)
      })
    })
  }

  private disableHandSelection(): void {
    this.player.hand.forEach((card) => {
      card.disableClick()
    })
  }

  private nextPlayerTurnOnSecondBettingRound(playerIndex: number): void {
    if (this.isSecondBettingEnd()) {
      // TODO: 役名を表示する

      const winPlayers = this.compareAllHands()
      let result = GameResult.LOSS
      if (winPlayers.length >= 2) {
        result = GameResult.TIE
      }
      if (winPlayers.includes(this.player)) {
        result = GameResult.WIN
      }
      this.showdown(result)
      return
    }

    let currentPlayerIndex = playerIndex
    if (playerIndex > this.players.length - 1) currentPlayerIndex = 0

    if (this.players[currentPlayerIndex].playerType === 'player') {
      this.createActionPanel()
    } else {
      this.cpuSecondBettingAction(1)
    }
  }

  private cpuSecondBettingAction(index: number): void {
    const decisionValue = PlayerAction.CALL
    this.cpuBettingStatus?.destroy()

    if (decisionValue === PlayerAction.CALL) {
      const betAmount = this.currentBetAmount - this.players[index].bet
      this.players[index].addBet(betAmount)
      this.players[index].gameStatus = PlayerAction.CALL

      this.time.delayedCall(1000, () => {
        this.createCpuBettingStatus(PlayerAction.CALL)
        this.animateChipToTableCenter(index)
        this.pot?.setAmount(betAmount)
      })
    }

    this.time.delayedCall(2500, () => {
      this.nextPlayerTurnOnSecondBettingRound(0)
    })
  }

  private showdown(result: GameResult): void {
    this.destroyActionPanel()
    this.payOut(result)
    const handRanks: Text[] = []

    this.playerHandZones.forEach((handZone, index) => {
      const player = this.players[index] as PokerPlayer
      const handRankText = Poker.getKeyByValue(HAND_RANK_MAP, player.getHandRank())

      const handRank = this.add
        .text(handZone.x, handZone.y, handRankText, textStyle)
        .setOrigin(0.5)
        .setDepth(10)

      handRanks.push(handRank)
    })

    this.showdownCpuHand()
    this.cpuBettingStatus?.destroy()

    // 勝敗結果表示
    const resultText = this.add
      .text(this.width / 2, this.height / 2, result, textStyle)
      .setOrigin(0.5)
      .setDepth(10)

    this.time.delayedCall(4000, () => {
      handRanks.forEach((handRank) => {
        handRank.destroy()
      })
      resultText.destroy()
      this.resetRound()
      this.dealInitialCards()
      this.PlayAnte()
    })

    this.time.delayedCall(5000, () => {
      this.createActionPanel()
    })
  }

  private static getKeyByValue(map: Map<string, number>, value: number): string {
    const entry = Array.from(map.entries()).find(([, val]) => val === value)
    return entry ? entry[0] : ''
  }

  private resetRound(): void {
    this.pot?.clear()
    this.currentBetAmount = 0
    this.playerBet = 0
    this.updateBText(0)
    this.clearPlayersBet()
    this.cpuBettingStatus?.destroy()

    this.players.forEach((player) => {
      // eslint-disable-next-line no-param-reassign
      player.gameStatus = GameStatus.FIRST_BETTING
      player.clearBet()
      player.hand.forEach((card) => card.destroy())
      player.clearHand()
    })

    this.playerDeck = new Deck(this, this.width / 2, -140, 'poker')
  }

  private showdownCpuHand(): void {
    this.players[1].hand.forEach((card) => {
      if (card.faceDown) {
        card.playFlipOverTween()
      }
    })
  }
}
