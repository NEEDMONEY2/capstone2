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
        model: "cad-q5e8u",
        version: 1
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
            const textHeight = parseInt(font, 10); // base 10
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth + 8,
                textHeight + 4
            );
        });

        predictions.forEach(function (prediction) {
            const classValueMapping = {
                "5cad": 5,
                "10cad": 10,
                "20cad": 20,
                "50cad": 50,
                "100cad": 100,
            }
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;
            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            // Draw the text last to ensure it's on top.
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(
                "$"+classValueMapping[prediction.class],
                (x - width / 2) / scale + 4,
                (y - height / 2) / scale + 1
            );
        });
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
                        "5cad": 5,
                        "10cad": 10,
                        "20cad": 20,
                        "50cad": 50,
                        "100cad": 100,
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
            "5cad": 5,
            "10cad": 10,
            "20cad": 20,
            "50cad": 50,
            "100cad": 100,
        };
    
        let totalValue = 0; // 결과를 합산할 변수
    
        predictions.forEach(function (prediction) {
            const classLabel = prediction.class;
            const value = classValueMapping[classLabel] || 0;
            totalValue += value; // 결과 합산
        });
    
        const resultsContainer = document.getElementById("results-container");
        resultsContainer.innerHTML = "";
    
        const resultElement = document.createElement("div");
        const finall = totalValue * cad_price; // 결과 합산값에 환율 적용
        const formattedValue = finall.toLocaleString();
        
        resultElement.textContent = `🇨🇦 : $${totalValue} ⠀=⠀🇰🇷 : ₩${formattedValue}`;
        resultsContainer.appendChild(resultElement);
    }
   
    
    
    
    
    
    



    // 
    //         }
    // -------------------------------------------------------------------------

    // 버튼 클릭 이벤트 처리
    // document.getElementById("startDetection").addEventListener("click", function () {
    //     // 객체 인식 로직을 시작
    //     startObjectDetection();


    //     // 3초 후 객체 인식을 멈추고 결과를 출력합니다.
    //     setTimeout(function () {
    //         stopObjectDetection();
    //         console.log("객체 인식 결과:", detectionResults);

    //         function findMode(arr) {
    //             let mode = null;
    //             let maxCount = 0;
    //             const count = {}; // 클래스별 등장 횟수를 저장할 객체

    //             for (const item of arr) {
    //                 if (!count[item]) {
    //                     count[item] = 1;
    //                 } else {
    //                     count[item]++;
    //                 }

    //                 if (count[item] > maxCount) {
    //                     maxCount = count[item];
    //                     mode = item;
    //                 }
    //             }

    //             return mode;
    //         }

    //         // detectionResults 배열에서 가장 자주 나타나는 클래스를 찾음
    //         const mostFrequentClass = findMode(detectionResults.flat());
    //         if (mostFrequentClass === null) {
    //             console.log("검출된 객체가 없습니다 다시 ㄱㄱ");
    //             // "검출된 객체가 없습니다" 메시지를 HTML에 출력
    //             document.getElementById("result").textContent = "검출된 객체가 없습니다 다시 ㄱㄱ";
    //         } else {
    //             console.log("가장 많이 출력된 클래스:", mostFrequentClass);


    //             // console.log("가장 많이 출력된 클래스:", mostFrequentClass);

    //             // "jpy_1000" -> 1000(숫자)로 변경
    //             const numericValue = parseInt(mostFrequentClass.replace("JPY_", ""), 10);
    //             if (!isNaN(numericValue)) {
    //                 console.log("숫자로 변환: " + numericValue * jpy_price);
    //             } else {
    //                 console.log("No valid numeric value found in the class.");
    //             }

    //             // html에 출력되는 값
    //             document.getElementById("result").textContent = "환률 계산 값: " + numericValue * jpy_price;
    //         }
    //         detectionResults = [];
    //     }, 3000); // 3초 (3000 밀리초)
    // });


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

