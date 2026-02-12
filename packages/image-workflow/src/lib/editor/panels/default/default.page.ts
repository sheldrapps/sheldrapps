import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";

@Component({
  selector: "cc-default-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  templateUrl: "./default.page.html",
  styleUrls: ["./default.page.scss"],
})
export class DefaultPage {
  bottomBarItems: ScrollableBarItem[] = [
    { id: "tools", label: "Tools", icon: "crop-outline" },
    { id: "adjustments", label: "Adjustments", icon: "options-outline" },
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  onBottomBarItemClick(id: string): void {
    switch (id) {
      case "tools":
        this.router.navigate(["tools"], { relativeTo: this.route });
        break;
      case "adjustments":
        this.router.navigate(["adjustments"], { relativeTo: this.route });
        break;
    }
  }
}
