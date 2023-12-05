/*jshint esversion:6*/

$(function () {
    const vieo = $("video")[0];

    var model;
    var cameraMode = "environment"; // or "user"

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: {
                facingMode: cameraMode
            }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

    var publishable_key = "rf_vqonodBKvZhOSKm8glHVdlatY3S2";
    var toLoad = {
        model: "cash-counter",
        version: 10
    };

    const loadModelPromise = new Promise(function (resolve, reject) {
        roboflow
            .auth({
                publishable_key: publishable_key
            })
            .load(toLoad)
            .then(function (m) {
                model = m;
                resolve();
            });
    });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        // Ratio of the video's intrisic dimensions
        var videoRatio = video.videoWidth / video.videoHeight;

        // The width and height of the video element
        var width = video.offsetWidth,
            height = video.offsetHeight;

        // The ratio of the element's width to its height
        var elementRatio = width / height;

        // If the video element is short and wide
        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            // It must be tall and thin, or exactly equal to the original ratio
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        console.log(
            video.videoWidth,
            video.videoHeight,
            video.offsetWidth,
            video.offsetHeight,
            dimensions
        );

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };
    const renderPredictions = function (predictions) {
        var dimensions = videoDimensions(video);
        var scale = 1;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;
            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            const classValueMapping = {
                "one": 1,
                "five": 5,
                "ten": 10,
                "fifty": 50,
                "twenty": 20,
            }

            // Draw the bounding box.
            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                width / scale,
                height / scale
            );

            // Draw the label background.
            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10);
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth,
                textHeight
            );
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "black";
            ctx.fillText(
                "$" + classValueMapping[prediction.class],
                (x - width / 2) / scale,
                (y - height / 2) / scale
            );
        });

        // predictions.forEach(function (prediction) {
        //     const classValueMapping = {
        //         "one": 1,
        //         "five": 5,
        //         "ten": 10,
        //         "fifty": 50,
        //         "twenty": 20,
        //     }
        //     const x = prediction.bbox.x;
        //     const y = prediction.bbox.y;
        //     const width = prediction.bbox.width;
        //     const height = prediction.bbox.height;

        //     // Draw the text last to ensure it's on top.
           
        // });
    };

    var prevTime;
    var pastFrameTimes = [];
    function detectFrame() {
        if (!model) {
            stopObjectDetection(); // 모델이 없을 경우 객체 인식 중지
            return;
        }

        detectFrameInterval = setInterval(function () {
            model
                .detect(video)
                .then(function (predictions) {
                    // 클래스 정보만 추출하여 detectionResults 배열에 추가
                    const classValueMapping = {
                        "one": 1,
                        "five": 5,
                        "ten": 10,
                        "fifty": 50,
                        "twenty": 20,
                    }

                    const classes = predictions.map(prediction => prediction.class);
                    let cla = classes[0]

                    const value = classValueMapping[cla] || 0;
                    // const keyValueObject = {
                    //     [cla]: value
                    //   };

                    detectionResults.push(cla);

                    // 결과를 집합(배열)에 추가
                    console.log("Detection Resultsx:", classes); // 결과 출력

                    console.log(value);
                    renderPredictions(predictions);

                    if (prevTime) {
                        pastFrameTimes.push(Date.now() - prevTime);
                        if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                        var total = 0;
                        pastFrameTimes.forEach(function (t) {
                            total += t / 1000;
                        });

                        var fps = pastFrameTimes.length / total;
                        $("#fps").text(Math.round(fps));
                    }
                    prevTime = Date.now();
                    updateHTMLResults(predictions);
                })

                .catch(function (e) {
                    console.log("CAUGHT", e);
                    clearInterval(detectFrameInterval); // 오류가 발생하면 객체 인식 중지
                });
        },); //0.5초마다 객체검출
    }

    function updateHTMLResults(predictions) {
        const classValueMapping = {
            "one": 1,
            "five": 5,
            "ten": 10,
            "fifty": 50,
            "twenty": 20,
        };

        let totalValue = 0; // 결과를 합산할 변수
        predictions.forEach(function (prediction) {
            const value = classValueMapping[prediction.class] || 0; //속성이 없을경우에는 0 으로 지정
            totalValue += value; // 결과 합산
        });

        const resultsContainer = document.getElementById("results-container");
        resultsContainer.innerHTML = "";

        const resultElement = document.createElement("div");
        const finall = totalValue * usd_price; // 결과 합산값에 환율 적용
        const formattedValue = finall.toLocaleString();

        resultElement.textContent = `🇺🇸 : $${totalValue} ⠀=⠀🇰🇷 : ₩${formattedValue}`;
        resultsContainer.appendChild(resultElement);
    }

    
    let detectionResults = [];
    let detectFrameInterval;

    function startObjectDetection() {
        console.log("함수 시작");
        detectFrame()
    }

    function stopObjectDetection() {
        clearInterval(detectFrameInterval);   // detectframe 오류로 정지시킴
    }

});

