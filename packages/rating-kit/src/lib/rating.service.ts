import { Injectable, inject } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { ModalController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { RATING_CONFIG_TOKEN } from './rating.config';
import { RatingGateService } from './rating-gate.service';
import { RatingFeedbackModalComponent } from './rating-feedback-modal.component';
import { RatingPromptComponent } from './rating-prompt.component';
import { RatingStorageService } from './rating-storage.service';
import { RATING_KIT_TRANSLATIONS } from './rating.translations';
import type {
  RatingAskContext,
  RatingFeedbackSubmission,
} from './rating.types';

@Injectable({ providedIn: 'root' })
export class RatingService {
  private readonly config = inject(RATING_CONFIG_TOKEN);
  private readonly gate = inject(RatingGateService);
  private readonly modalController = inject(ModalController);
  private readonly storage = inject(RatingStorageService);
  private readonly translate = inject(TranslateService);

  private hasInitialized = false;
  private promptIsOpen = false;
  private lastSuccessEventName?: string;

  async initialize(): Promise<void> {
    if (this.hasInitialized) {
      return;
    }

    this.hasInitialized = true;
    this.registerTranslations();
    await this.storage.updateState((state) => ({
      ...state,
      appLaunchCount: state.appLaunchCount + 1,
    }));
  }

  async trackSuccessEvent(eventName: string): Promise<void> {
    this.lastSuccessEventName = eventName;
    await this.storage.updateState((state) => ({
      ...state,
      successCount: state.successCount + 1,
    }));
  }

  async maybeAskForRating(context?: RatingAskContext): Promise<void> {
    if (this.promptIsOpen) {
      return;
    }

    const state = await this.storage.getState();
    const decision = this.gate.evaluate(state);
    if (!decision.eligible) {
      return;
    }

    this.promptIsOpen = true;

    try {
      const modal = await this.createPromptModal();

      await modal.present();
      await this.storage.updateState((currentState) => ({
        ...currentState,
        promptCount: currentState.promptCount + 1,
        lastPromptAt: this.getNowIso(),
      }));

      const { role } = await modal.onWillDismiss();
      if (role === 'rate') {
        await this.openStoreReview();
        await this.markRated();
        return;
      }

      if (role === 'suggestions') {
        if (this.config.feedbackEnabled) {
          await this.openSuggestionFlow(this.mergeContext(context));
        } else {
          await this.dismissTemporarily();
        }
        return;
      }

      if (role === 'problem') {
        if (this.config.feedbackEnabled) {
          await this.openFeedbackFlow(this.mergeContext(context));
        } else {
          await this.dismissTemporarily();
        }
        return;
      }

      await this.dismissTemporarily();
    } finally {
      this.promptIsOpen = false;
    }
  }

  async previewPrompt(): Promise<void> {
    if (this.promptIsOpen) {
      return;
    }

    this.promptIsOpen = true;

    try {
      const modal = await this.createPromptModal();

      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'rate') {
        await this.openStoreReview();
        return;
      }

      if (role === 'suggestions') {
        await this.previewSuggestionFlow();
        return;
      }

      if (role === 'problem') {
        await this.previewFeedbackFlow();
      }
    } finally {
      this.promptIsOpen = false;
    }
  }

  async previewFeedbackFlow(): Promise<void> {
    const modal = await this.createFeedbackModal('problem');

    await modal.present();
    const { data, role } = await modal.onWillDismiss<RatingFeedbackSubmission>();
    if (role === 'send' && data) {
      await this.openFeedbackEmail(data);
    }
  }

  async previewSuggestionFlow(): Promise<void> {
    const modal = await this.createFeedbackModal('suggestion');

    await modal.present();
    const { data, role } = await modal.onWillDismiss<RatingFeedbackSubmission>();
    if (role === 'send' && data) {
      await this.openSuggestionEmail(data);
    }
  }

  async markRated(): Promise<void> {
    await this.storage.updateState((state) => ({
      ...state,
      ratedAt: state.ratedAt ?? this.getNowIso(),
    }));
  }

  async dismissTemporarily(): Promise<void> {
    await this.storage.updateState((state) => ({
      ...state,
      dismissedAt: this.getNowIso(),
    }));
  }

  async openStoreReview(): Promise<void> {
    if (await this.tryOpenInAppReview()) {
      return;
    }

    const openedStoreUrl = await this.openExternalUrl(this.config.storeReviewUrl, {
      preferLocationHref: true,
    });

    if (!openedStoreUrl) {
      await this.openExternalUrl(this.config.webReviewUrl);
    }
  }

  async openFeedbackFlow(context?: RatingAskContext): Promise<void> {
    const modal = await this.createFeedbackModal('problem');

    await modal.present();
    const { data, role } = await modal.onWillDismiss<RatingFeedbackSubmission>();
    if (role !== 'send' || !data) {
      return;
    }

    await this.openFeedbackEmail(data, this.mergeContext(context));
    await this.storage.updateState((state) => ({
      ...state,
      feedbackSentAt: this.getNowIso(),
    }));
  }

  async openSuggestionFlow(context?: RatingAskContext): Promise<void> {
    const modal = await this.createFeedbackModal('suggestion');

    await modal.present();
    const { data, role } = await modal.onWillDismiss<RatingFeedbackSubmission>();
    if (role !== 'send' || !data) {
      return;
    }

    await this.openSuggestionEmail(data, this.mergeContext(context));
    await this.storage.updateState((state) => ({
      ...state,
      feedbackSentAt: this.getNowIso(),
    }));
  }

  private createFeedbackModal(mode: 'problem' | 'suggestion') {
    return this.modalController.create({
      component: RatingFeedbackModalComponent,
      componentProps: {
        mode,
        feedbackOptions: this.config.feedbackOptions,
      },
    });
  }

  private createPromptModal() {
    return this.modalController.create({
      component: RatingPromptComponent,
      cssClass: 'rating-prompt-modal',
      backdropDismiss: true,
      showBackdrop: true,
    });
  }

  private async openFeedbackEmail(
    submission: RatingFeedbackSubmission,
    context?: RatingAskContext,
  ): Promise<void> {
    const subject = encodeURIComponent(`Feedback ${this.config.appName}`);
    const body = encodeURIComponent(this.buildFeedbackBody(submission, context));
    const mailtoUrl = `mailto:${this.config.supportEmail}?subject=${subject}&body=${body}`;
    await this.openExternalUrl(mailtoUrl);
  }

  private async openSuggestionEmail(
    submission: RatingFeedbackSubmission,
    context?: RatingAskContext,
  ): Promise<void> {
    const subject = encodeURIComponent(`Suggestions ${this.config.appName}`);
    const body = encodeURIComponent(this.buildSuggestionBody(submission, context));
    const mailtoUrl = `mailto:${this.config.supportEmail}?subject=${subject}&body=${body}`;
    await this.openExternalUrl(mailtoUrl);
  }

  private buildFeedbackBody(
    submission: RatingFeedbackSubmission,
    context?: RatingAskContext,
  ): string {
    const option = this.config.feedbackOptions.find(
      (feedbackOption) => feedbackOption.id === submission.optionId,
    );
    const issueLabel = option
      ? this.resolveFeedbackOptionLabel(option)
      : submission.optionId;
    const bodyLines = [
      `App: ${this.config.appName}`,
      `Package: ${this.config.packageName}`,
      `Issue: ${issueLabel}`,
      `Source: ${context?.source || 'unknown'}`,
      `Success event: ${context?.successEventName || 'unknown'}`,
    ];

    if (context?.metadata) {
      bodyLines.push(`Metadata: ${JSON.stringify(context.metadata)}`);
    }

    if (submission.details) {
      bodyLines.push('', submission.details);
    }

    return bodyLines.join('\n');
  }

  private buildSuggestionBody(
    submission: RatingFeedbackSubmission,
    context?: RatingAskContext,
  ): string {
    const bodyLines = [
      `App: ${this.config.appName}`,
      `Package: ${this.config.packageName}`,
      'Type: Suggestion inbox',
      `Source: ${context?.source || 'unknown'}`,
      `Success event: ${context?.successEventName || 'unknown'}`,
    ];

    if (context?.metadata) {
      bodyLines.push(`Metadata: ${JSON.stringify(context.metadata)}`);
    }

    if (submission.details) {
      bodyLines.push('', submission.details);
    }

    return bodyLines.join('\n');
  }

  private resolveFeedbackOptionLabel(option: {
    labelKey: string;
    fallbackLabel: string;
  }): string {
    const translated = this.translate.instant(option.labelKey);
    return translated && translated !== option.labelKey
      ? translated
      : option.fallbackLabel;
  }

  private mergeContext(context?: RatingAskContext): RatingAskContext | undefined {
    if (!context && !this.lastSuccessEventName) {
      return undefined;
    }

    return {
      ...context,
      successEventName: context?.successEventName ?? this.lastSuccessEventName,
    };
  }

  private async tryOpenInAppReview(): Promise<boolean> {
    const plugins = (
      globalThis as typeof globalThis & {
        Capacitor?: {
          Plugins?: Record<string, Record<string, (...args: never[]) => unknown>>;
        };
      }
    ).Capacitor?.Plugins;

    const reviewPlugin =
      plugins?.['InAppReview'] ??
      plugins?.['AppReview'] ??
      plugins?.['AppRating'];
    if (!reviewPlugin) {
      return false;
    }

    const requestReview =
      typeof reviewPlugin['requestReview'] === 'function'
        ? reviewPlugin['requestReview'].bind(reviewPlugin)
        : typeof reviewPlugin['open'] === 'function'
          ? reviewPlugin['open'].bind(reviewPlugin)
          : null;
    if (!requestReview) {
      return false;
    }

    try {
      await requestReview();
      return true;
    } catch {
      return false;
    }
  }

  private async openExternalUrl(
    url: string,
    options: { preferLocationHref?: boolean } = {},
  ): Promise<boolean> {
    if (!url) {
      return false;
    }

    try {
      if (options.preferLocationHref && this.canUseLocationHref()) {
        this.getWindowLocation()?.assign(url);
        return true;
      }

      await Browser.open({ url });
      return true;
    } catch {
      if (this.canUseWindowOpen()) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
      }

      if (this.canUseLocationHref()) {
        this.getWindowLocation()?.assign(url);
        return true;
      }

      return false;
    }
  }

  private canUseWindowOpen(): boolean {
    return typeof window !== 'undefined' && typeof window.open === 'function';
  }

  private canUseLocationHref(): boolean {
    return Capacitor.isNativePlatform() || typeof window !== 'undefined';
  }

  private getWindowLocation(): Location | null {
    return typeof window !== 'undefined' ? window.location : null;
  }

  private getNowIso(): string {
    return new Date().toISOString();
  }

  private registerTranslations(): void {
    this.registerTranslationsForLocale(
      this.translate.currentLang || this.translate.defaultLang || 'en-US',
    );

    this.translate.onLangChange.subscribe(({ lang }) => {
      this.registerTranslationsForLocale(lang);
    });
  }

  private registerTranslationsForLocale(locale: string): void {
    const translations = RATING_KIT_TRANSLATIONS[
      locale as keyof typeof RATING_KIT_TRANSLATIONS
    ];

    if (!translations) {
      return;
    }

    this.translate.setTranslation(locale, translations, true);

    const overrides = this.config.translationOverrides?.[locale];
    if (overrides) {
      this.translate.setTranslation(locale, overrides, true);
    }
  }
}
