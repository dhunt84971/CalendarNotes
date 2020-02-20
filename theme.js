// #region THEMES
var themeWarm = {
    name: "Warm",
    buttonface: "#2D262C",
    buttontext: "#fff",
    buttonbordersize: "0px",
    buttonborder: "none",
    buttonbordercolor: "#fff",
    buttonhover: "#536471",
    buttonhovertext: "#fff",
    titlebar: "#CF5429",
    titletext: "#fff",
    compColor1: "#DBA9A3",
    compColor2: "#B29294",
    notesBGColor: "#fff",
    notesTextColor: "#000",
    bodyColor: "#e0e0e0",
    invertSettingsIcon: "false",
    calBorder: "#2D262C"
  };
  
  var themeCool = {
    name: "Cool",
    buttonface: "#0D083B",
    buttontext: "#fff",
    buttonbordersize: "0px",
    buttonborder: "none",
    buttonbordercolor: "#fff",
    buttonhover: "#5A5494",
    buttonhovertext: "#fff",
    titlebar: "#383276",
    titletext: "#fff",
    compColor1: "#5A5494",
    compColor2: "#837EB1",
    notesBGColor: "#fff",
    notesTextColor: "#000",
    bodyColor: "#e0e0e0",
    invertSettingsIcon: "false",
    calBorder: "#0D083B"
  };
  
  var themeGreen = {
    name: "Green",
    buttonface: "#074600",
    buttontext: "#fff",
    buttonbordersize: "0px",
    buttonborder: "none",
    buttonbordercolor: "#fff",
    buttonhover: "#1A6811",
    buttonhovertext: "#fff",
    titlebar: "#2B8D21",
    titletext: "#fff",
    compColor1: "#5FAE57",
    compColor2: "#92D18B",
    notesBGColor: "#fff",
    notesTextColor: "#000",
    bodyColor: "#e0e0e0",
    invertSettingsIcon: "false",
    calBorder: "#074600"
  };
  
  var themePink = {
    name: "Pink",
    buttonface: "#6B1F17",
    buttontext: "#fff",
    buttonbordersize: "0px",
    buttonborder: "none",
    buttonbordercolor: "#fff",
    buttonhover: "#9A392F",
    buttonhovertext: "#fff",
    titlebar: "#BC2110",
    titletext: "#fff",
    compColor1: "#F26A5C",
    compColor2: "#FF5E4D",
    notesBGColor: "#fff",
    notesTextColor: "#000",
    bodyColor: "#e0e0e0",
    invertSettingsIcon: "false",
    calBorder: "#6B1F17"
  };
  
  var themeDefault = {
    name: "Default",
    buttonface: "#a74c00",
    buttontext: "#fff",
    buttonbordersize: "0px",
    buttonborder: "none",
    buttonbordercolor: "#fff",
    buttonhover: "#d96200",
    buttonhovertext: "#fff",
    titlebar: "#ff7400",
    titletext: "#fff",
    compColor1: "#ffb170",
    compColor2: "#ffcda4",
    notesBGColor: "#fff",
    notesTextColor: "#000",
    bodyColor: "#e0e0e0",
    invertSettingsIcon: "false",
    calBorder: "#a74c00"
  };
  
  var themeTron = {
    name: "Tron",
    buttonface: "#272727",
    buttontext: "rgb(0, 255, 234)",
    buttonbordersize: "1px",
    buttonborder: "solid",
    buttonbordercolor: "rgb(0, 255, 234)",
    buttonhover: "rgb(0, 207, 190)",
    buttonhovertext: "#000",
    titlebar: "rgb(0, 255, 234)",
    titletext: "#272727",
    compColor1: "rgb(226, 255, 253)",
    compColor2: "rgb(173, 224, 220)",
    notesBGColor: "#272727",
    notesTextColor: "rgb(0, 255, 234)",
    bodyColor: "#272727",
    invertSettingsIcon: "true",
    calBorder: "rgb(0, 255, 234)"
  };
  
  var themeClu = {
    name: "Clu",
    buttonface: "#272727",
    buttontext: "#FFD93F",
    buttonbordersize: "1px",
    buttonborder: "solid",
    buttonbordercolor: "#FFD93F",
    buttonhover: "#FFE88D",
    buttonhovertext: "#000",
    titlebar: "#FFD93F",
    titletext: "#272727",
    compColor1: "#B89405",
    compColor2: "#F3C60C",
    notesBGColor: "#272727",
    notesTextColor: "#FFD93F",
    bodyColor: "#272727",
    invertSettingsIcon: "true",
    calBorder: "#FFD93F"
  };
  
  var themes = [
    themeDefault,
    themeWarm,
    themeCool,
    themeGreen,
    themePink,
    themeTron,
    themeClu
  ];

  var selectedTheme = 0;
  
  function changeTheme(themeIndex, callback) {
    console.log("changeTheme called, themeIndex = " + themeIndex);
    var d = document.documentElement.style;
    d.setProperty("--buttonface", themes[themeIndex].buttonface);
    d.setProperty("--buttontext", themes[themeIndex].buttontext);
    d.setProperty("--buttonbordersize", themes[themeIndex].buttonbordersize);
    d.setProperty("--buttonborder", themes[themeIndex].buttonborder);
    d.setProperty("--buttonbordercolor", themes[themeIndex].buttonbordercolor);
    d.setProperty("--buttonhover", themes[themeIndex].buttonhover);
    d.setProperty("--buttonhovertext", themes[themeIndex].buttonhovertext);
    d.setProperty("--titlebar", themes[themeIndex].titlebar);
    d.setProperty("--titletext", themes[themeIndex].titletext);
    d.setProperty("--compColor1", themes[themeIndex].compColor1);
    d.setProperty("--compColor2", themes[themeIndex].compColor2);
    d.setProperty("--notesBGColor", themes[themeIndex].notesBGColor);
    d.setProperty("--notesTextColor", themes[themeIndex].notesTextColor);
    d.setProperty("--bodyColor", themes[themeIndex].bodyColor);
    d.setProperty("--invertSettingsIcon", themes[themeIndex].invertSettingsIcon);
    d.setProperty("--calBorder", themes[themeIndex].calBorder);
    selectedTheme = themeIndex;
  
    if (callback) callback();
  }
  