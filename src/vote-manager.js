// TODO Make events type safe
export class VotingEndedEvent extends Event {
  /** @type {Map<import("./player.js").default, number>} */
  scores;

  /**
   * Constructs a new voting ended event.
   * @param {Map<import("./player.js").default, number>} scores - Scores of the
   * players after voting.
   */
  constructor(scores) {
    super("voting-ended");

    this.scores = scores;
  }
}

export default class VoteManager extends EventTarget {
  /** @type {NodeJS.Timeout | undefined} */
  #categoryInterval;

  /** @type {import("./player.js").default[]} */
  #players;

  /** @type {string[]} */
  #categories;

  /**
   * Constructs a new vote manager.
   * @param {import("./player.js").default[]} players - Players in the room.
   * @param {string[]} categories - Categories available in the room.
   */
  constructor(players, categories) {
    super();

    this.#players = players;
    this.#categories = categories;
  }

  /**
   * Begins voting for a category.
   * @param {string} category - Category to vote for.
   * @param {number} duration - Duration of the voting period.
   */
  #beginVotingFor(category, duration) {
    const answers = new Set(
      this.#players.flatMap((player) => player.answers.get(category) ?? [])
    );

    for (const player of this.#players) {
      player.send({
        type: "category-vote-started",
        content: {
          category,
          answers: [...answers],
          duration,
        },
      });
    }
  }

  /**
   * Calculates player scores for a category.
   * @param {string} category - Category to calculate scores for.
   * @returns {Map<import("./player.js").default, number>} - Scores of the
   * players.
   */
  #calculateCategoryScores(category) {
    const answers = [
      ...new Set(
        this.#players.flatMap((player) => player.answers.get(category) ?? [])
      ),
    ];

    const answerScores = new Map(answers.map((answer) => [answer, 0]));
    for (const vote of this.#players.flatMap((player) => [...player.votes]))
      answerScores.set(vote, (answerScores.get(vote) ?? 0) + 1);

    const playerScores = new Map(
      this.#players.map((player) => {
        const answer = player.answers.get(category);
        const score = answer ? answerScores.get(answer) ?? 0 : 0;

        return [player, score];
      })
    );

    return playerScores;
  }

  /**
   * Starts the voting process.
   * Will fire a `voting-ended` event when voting is over.
   */
  start() {
    const DURATION = 7500;

    let categoryIndex = 0;

    const scores = new Map(this.#players.map((player) => [player, 0]));

    const interval = setInterval(() => {
      // Add scores from the previous category to the total scores
      if (categoryIndex > 0) {
        const previousCategory = this.#categories[categoryIndex - 1];
        if (previousCategory == undefined)
          throw new Error(
            `No category at index ${categoryIndex - 1}. This should never be thrown.`
          );

        const categoryScores = this.#calculateCategoryScores(previousCategory);
        for (const [player, score] of categoryScores) {
          scores.set(player, (scores.get(player) ?? 0) + score);
        }
      }

      if (categoryIndex >= this.#categories.length) {
        clearInterval(interval);
        this.dispatchEvent(new VotingEndedEvent(scores));
        return;
      }

      const category = this.#categories[categoryIndex];
      if (category == undefined)
        throw new Error(
          `No category at index ${categoryIndex}. This should never be thrown.`
        );

      this.#beginVotingFor(category, DURATION);

      ++categoryIndex;
    }, DURATION);
  }

  /** Interrupts the voting process. */
  stop() {
    if (this.#categoryInterval != undefined)
      clearInterval(this.#categoryInterval);
    this.#categoryInterval = undefined;
  }
}
