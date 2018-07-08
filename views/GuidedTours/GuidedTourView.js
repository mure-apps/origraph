/* globals d3 */
import GoldenLayoutView from '../Common/GoldenLayoutView.js';
import OperationOptionsRenderer from '../Common/OperationOptionsRenderer.js';

class GuidedTourView extends GoldenLayoutView {
  constructor ({
    container,
    state,
    operationList
  }) {
    super({
      container,
      icon: GuidedTourView.icon,
      label: GuidedTourView.label,
      state
    });
    this.operationList = operationList;
  }
  setup () {
    super.setup();
    // normally views are classed by their immediate class name, but we
    // want some styles to apply across all guided tours
    this.content.classed('GuidedTourView', true);
    this.content.append('h2')
      .text(this.label);
    this.content.append('p')
      .html(this.description);
    this.content.append('div')
      .classed('steps', true);
    this.content.append('div')
      .classed('allDone', true);
  }
  drawFinishedState (element) {
    let message = element.select('.message');
    if (message.size() === 0) {
      message = element.append('div')
        .classed('message', true);
      message.text('All done!');
    }
  }
  get currentStep () {
    return this.container.getState().currentStep;
  }
  set currentStep (stepNo) {
    this.container.extendState({ currentStep: stepNo });
  }
  async drawReadyState (content) {
    let steps = content.select('.steps').selectAll('.step')
      .data(this.operationList);
    steps.exit().remove();
    let stepsEnter = steps.enter().append('div')
      .classed('step', true);
    steps = steps.merge(stepsEnter);

    stepsEnter.append('img');
    steps.select('img')
      .attr('src', d => {
        return `img/${d.parentOperation
          ? d.parentOperation.lowerCamelCaseName : d.lowerCamelCaseName}.svg`;
      });

    stepsEnter.append('div').classed('stepTitle', true);
    steps.select('.stepTitle').text(d => d.humanReadableName);

    stepsEnter.append('div').classed('settings', true);

    let applyButtonEnter = stepsEnter.append('div')
      .classed('button', true);
    applyButtonEnter.append('a');
    applyButtonEnter.append('span')
      .text('Apply and Continue');

    const self = this;
    steps.each(function (d, i) {
      const el = d3.select(this);
      el.classed('complete', i < self.currentStep);
      el.classed('current', i === self.currentStep);
      el.classed('future', i > self.currentStep);
      if (i === self.currentStep) {
        (async () => {
          let optionRenderer = new OperationOptionsRenderer(
            el.select('.settings'), d, window.mainView.userSelection);
          optionRenderer.drawOptions();
          el.select('.button').classed('disabled', !(await optionRenderer.ready()))
            .on('click', async () => {
              if (i === self.currentStep && await optionRenderer.ready()) {
                const settings = await optionRenderer.getSettings();
                window.mainView.setUserSelection(await window.mainView.userSelection
                  .execute(settings.operation, settings.parameters));
                self.currentStep = self.currentStep + 1;
              }
            });
        })();
      }
    });

    const allDone = this.d3el.select('.allDone')
      .style('display', this.currentStep >= this.operationList.length ? null : 'none');
    if (this.currentStep >= this.operationList.length) {
      this.drawFinishedState(allDone);
    }
  }
}
GuidedTourView.icon = 'img/guidedTour.svg';
GuidedTourView.label = 'Guided Tour';

export default GuidedTourView;
