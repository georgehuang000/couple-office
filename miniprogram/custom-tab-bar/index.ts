Component({
  data: {
    selected: 0,
    color: "#77716b",
    selectedColor: "#53644f",
    list: [
      { pagePath: "/pages/workbench/index", text: "工作台", icon: "home" },
      { pagePath: "/pages/items/index", text: "事项", icon: "note" },
      { pagePath: "/pages/calendar/index", text: "日历", icon: "time" },
      { pagePath: "/pages/us/index", text: "我们", icon: "group-detail" }
    ]
  },
  methods: {
    switchTab(event: any) {
      const index = Number(event.currentTarget.dataset.index);
      wx.switchTab({ url: this.data.list[index].pagePath });
      this.setData({ selected: index });
    }
  }
});
